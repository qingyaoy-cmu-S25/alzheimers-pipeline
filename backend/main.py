from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi import UploadFile, File
from pydantic import BaseModel
import json
import asyncio
from typing import List, Optional
import os
from datetime import datetime
from dotenv import load_dotenv
import h5py, pandas as pd, io, json

# Load environment variables from .env file
# Handle encoding issues gracefully
try:
    load_dotenv(encoding='utf-8')
except UnicodeDecodeError:
    # If UTF-8 fails, try without specifying encoding (let dotenv handle it)
    try:
        load_dotenv()
    except Exception:
        # If .env file doesn't exist or has issues, continue without it
        # Environment variables can still be set via system/env
        pass
except Exception:
    # Any other error loading .env - continue without it
    pass

from models.openai_chat import get_openai_streaming_response, format_messages
from kernel_manager import get_kernel_manager
from storage.azure_blob_manager import get_blob_manager

app = FastAPI(title="Alzheimer's Analysis Pipeline API")

# Global state for current notebook
NOTEBOOKS_DIR = os.path.join(os.path.dirname(__file__), "notebooks")  # Local cache directory
WORKSPACE_DIR = os.path.join(os.path.dirname(__file__), "workspace")  # Workspace for data files
CURRENT_NOTEBOOK = "demo_notebook.ipynb"  # Default demo notebook

# Ensure workspace directory exists
os.makedirs(WORKSPACE_DIR, exist_ok=True)

def sync_azure_files_to_local():
    """Sync all files from Azure uploads container to local workspace"""
    if not USE_AZURE_STORAGE or blob_manager is None:
        return

    try:
        print("Syncing Azure files to local workspace...")
        files = blob_manager.list_files()

        for file_info in files:
            filename = file_info['filename']
            local_path = os.path.join(WORKSPACE_DIR, filename)

            # Check if file already exists locally with same size
            if os.path.exists(local_path):
                local_size = os.path.getsize(local_path)
                if local_size == file_info['size']:
                    continue  # Skip if same size

            # Download from Azure
            try:
                content = blob_manager.download_file(filename)
                with open(local_path, 'wb') as f:
                    f.write(content)
                print(f"  ✓ Synced: {filename}")
            except Exception as e:
                print(f"  ✗ Failed to sync {filename}: {e}")

        print(f"Sync complete. {len(files)} files in Azure uploads container.")
    except Exception as e:
        print(f"Warning: Failed to sync Azure files: {e}")

# Initialize Azure Blob Manager
try:
    blob_manager = get_blob_manager()
    USE_AZURE_STORAGE = True
    print("✓ Azure Blob Storage initialized successfully")

    # Upload default notebook to Azure if it exists locally but not in Azure
    default_notebook_path = os.path.join(NOTEBOOKS_DIR, CURRENT_NOTEBOOK)
    if os.path.exists(default_notebook_path) and not blob_manager.notebook_exists(CURRENT_NOTEBOOK):
        try:
            with open(default_notebook_path, "rb") as f:
                content = f.read()
            blob_manager.upload_notebook(CURRENT_NOTEBOOK, content)
            print(f"✓ Uploaded default notebook '{CURRENT_NOTEBOOK}' to Azure Blob Storage")
        except Exception as upload_error:
            print(f"⚠ Warning: Could not upload default notebook to Azure: {upload_error}")

    # Sync Azure files to local workspace on startup
    sync_azure_files_to_local()

except Exception as e:
    blob_manager = None
    USE_AZURE_STORAGE = False
    print(f"✗ Azure Blob Storage not available: {e}")
    print("  Falling back to local storage")

# Enable CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models for API endpoints
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []

class ExecuteRequest(BaseModel):
    code: str
    cell_id: Optional[int] = None

class SelectNotebookRequest(BaseModel):
    filename: str

@app.get("/")
async def root():
    return {"message": "Alzheimer's Analysis Pipeline API"}

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """WebSocket endpoint for streaming chat"""
    await websocket.accept()
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            
            try:
                # Parse the incoming message
                message_data = json.loads(data)
                user_message = message_data.get("message", "")
                chat_history = message_data.get("history", [])
                
                if not user_message.strip():
                    await websocket.send_text("<<<ERROR>>>")
                    continue
                
                # Format messages for OpenAI
                messages = format_messages(user_message, chat_history)
                
                # Get streaming response from OpenAI
                print(f"Processing message: {user_message}")
                response_generator = get_openai_streaming_response(messages)
                
                # Stream each chunk to the client with proper async handling
                async for chunk in response_generator:
                    if chunk is not None and chunk != '':
                        print(f"Sending chunk: '{chunk}'")
                        await websocket.send_text(chunk)
                        # Small delay to ensure chunks are sent separately
                        await asyncio.sleep(0.02)
                
                # Send end marker
                await websocket.send_text("<<<END>>>")
                
            except json.JSONDecodeError:
                await websocket.send_text("<<<ERROR>>>")
            except Exception as e:
                print(f"Chat error: {e}")
                await websocket.send_text("<<<ERROR>>>")
                
    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """HTTP endpoint for streaming chat (alternative to WebSocket)"""
    try:
        messages = format_messages(request.message, [msg.dict() for msg in request.history])
        
        # Collect all chunks for HTTP response
        response_chunks = []
        async for chunk in get_openai_streaming_response(messages):
            if chunk:
                response_chunks.append(chunk)
        
        full_response = "".join(response_chunks)
        return {"response": full_response}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/execute")
async def execute_code(request: ExecuteRequest):
    """Execute Python code using Jupyter kernel"""
    import logging
    logger = logging.getLogger(__name__)

    try:
        logger.info(f"Received execute request for cell {request.cell_id}")
        km = get_kernel_manager()
        result = km.execute_code(request.code, request.cell_id)
        logger.info(f"Execution completed, sending response back")
        return result
    except Exception as e:
        logger.error(f"Execution error: {e}")
        return {
            "outputs": [{
                "type": "error",
                "ename": "KernelError",
                "evalue": str(e),
                "traceback": [str(e)]
            }],
            "status": "error"
        }



@app.post("/api/process_data")
async def process_data(payload: dict):
    """Receive CSV text in `payload['data']`, parse it, generate a preview and call OpenAI to recommend 3 charts.

    Expected input JSON: { "data": "<csv content>" }
    Returns JSON: { dataInfo, preview, recommendations }
    """
    import io
    import pandas as pd
    try:
        data = payload.get("data") if isinstance(payload, dict) else None
        if data is None:
            raise ValueError("Missing 'data' in request body")

        # Support multiple input formats from frontend:
        # 1) raw CSV text (string)
        # 2) parsed object { headers: string[], rows: string[][] } (from FileUploader.parseCSV)
        # 3) list of records (list[dict])
        df = None
        if isinstance(data, str):
            # raw CSV text
            csv_text = data
            print("csv_text received:", csv_text[:100])  # Print first 100 chars for debug
            # Try to read CSV into pandas, allow flexible separators
            try:
                df = pd.read_csv(io.StringIO(csv_text), sep=None, engine='python')
            except Exception:
                # fallback to comma
                df = pd.read_csv(io.StringIO(csv_text))
        elif isinstance(data, dict) and 'headers' in data and 'rows' in data:
            # Parsed format from frontend FileUploader: headers + rows (array of arrays)
            headers = data.get('headers') or []
            rows = data.get('rows') or []
            # Build list of records
            records = []
            for r in rows:
                # If row is shorter/longer than headers, align accordingly
                row_dict = {headers[i]: (r[i] if i < len(r) else None) for i in range(len(headers))}
                records.append(row_dict)
            df = pd.DataFrame.from_records(records, columns=headers)
        elif isinstance(data, list):
            # list of records
            df = pd.DataFrame.from_records(data)
        else:
            raise ValueError("Unrecognized 'data' format. Expect raw CSV text or parsed {headers, rows} or list of records")

        # Build data summary
        n_rows, n_cols = df.shape
        columns = list(df.columns.astype(str))
        dtypes = {col: str(dtype) for col, dtype in df.dtypes.items()}

        # Simple type counts
        numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
        categorical_cols = df.select_dtypes(include=['object', 'category', 'bool']).columns.tolist()

        data_info = {
            'samples': int(n_rows),
            'features': int(n_cols),
            'columns': columns,
            'dtypes': dtypes,
            'numeric_columns': numeric_cols,
            'categorical_columns': categorical_cols,
            'type': 'table'
        }

        # Preview first 5 rows as records (stringify safe)
        preview = df.head(5).astype(str).to_dict(orient='records')

        # If mock mode enabled, return fake recommendations
        if os.getenv('OPENAI_MOCK', '').lower() in ['1', 'true', 'yes']:
            recommendations = [
                { 'name': 'Bar Chart', 'confidence': 90, 'reason': 'Categorical distribution', 'fields': [columns[0]] },
                { 'name': 'Scatter Plot', 'confidence': 80, 'reason': 'Numeric correlation', 'fields': numeric_cols[:2] },
                { 'name': 'Box Plot', 'confidence': 75, 'reason': 'Summary of numeric spread', 'fields': numeric_cols[:1] },
            ]

            return { 'dataInfo': data_info, 'preview': preview, 'recommendations': recommendations }

        # Build prompt for OpenAI to return 3 chart recommendations in JSON
        sample_cols = ', '.join(columns[:10])
        user_prompt = (
            f"You are a data visualization expert. Given the following dataset:\n"
            f"Rows: {n_rows}, Columns: {n_cols}. Columns: {sample_cols}.\n"
            f"Numeric columns: {numeric_cols}. Categorical columns: {categorical_cols}.\n"
            f"\n"
            f"Sample data preview:\n{json.dumps(preview[:3], indent=2)}\n"
            f"\n"
            f"Please recommend exactly 3 appropriate chart types for this data.\n"
            f"\n"
            f"For EACH recommendation, return a JSON object with EXACTLY these keys:\n"
            f"- name: (string) short human-readable chart title\n"
            f"- confidence: (integer 0-100) confidence that this chart fits the data\n"
            f"- reason: (string) brief 1-2 sentence rationale\n"
            f"- fields: (array of strings) column names the chart should use (e.g., ['Variable', 'IRR'])\n"
            f"- d3_js: (string) D3 v7 JavaScript code (can be IIFE or plain statements) that renders the chart into element with id='sandbox'.\n"
            f"\n"
            f"IMPORTANT CONSTRAINTS for d3_js:\n"
            f"1. Code will be executed in an iframe with D3 v7 loaded globally.\n"
            f"2. The variable 'data' (array of objects) is provided globally before your code runs.\n"
            f"3. A container <div id='sandbox'></div> exists. Use d3.select('#sandbox') to access it, NOT '#root'.\n"
            f"4. If code is wrapped in IIFE: (function(){{ ... }})(); - that's fine, it will execute.\n"
            f"5. If code is plain statements - that's also fine, no wrapper needed.\n"
            f"6. Handle string numbers: parseFloat(String(value).replace(/,/g, ''))\n"
            f"7. Clear sandbox first: d3.select('#sandbox').selectAll('*').remove();\n"
            f"8. Use D3 v7 patterns: .join(), .enter(), .exit() properly.\n"
            f"9. Build proper scales, axes, margins for a professional chart.\n"
            f"10. Use visual encoding: colors, sizes, positions for different dimensions.\n"
            f"\n"
            f"Return result as valid JSON ONLY:\n"
            f"- Option 1: top-level array: [{{ ... }}, {{ ... }}, {{ ... }}]\n"
            f"- Option 2: object with key: {{ \"recommendations\": [{{ ... }}, ...] }}\n"
            f"\n"
            f"CRITICAL: NO markdown, NO code blocks, NO backticks, NO extra text. ONLY valid JSON parseable by JSON.parse()."
        )

        messages = format_messages(user_prompt, [])

        # Collect streamed response
        response_chunks = []
        async for chunk in get_openai_streaming_response(messages):
            if chunk:
                response_chunks.append(chunk)

        model_text = "".join(response_chunks).strip()

        # Try to parse JSON from model_text
        import re, json as _json
        try:
            # extract first JSON-like block
            m = re.search(r"\{.*\}|\[.*\]", model_text, flags=re.S)
            if not m:
                # no JSON-like block found, return raw text
                return {'dataInfo': data_info, 'preview': preview, 'recommendations_text': model_text}

            json_text = m.group(0)
            parsed = None

            # First try strict JSON
            try:
                parsed = _json.loads(json_text)
            except Exception:
                # Fallback: try Python literal eval (handles single quotes)
                try:
                    import ast
                    parsed = ast.literal_eval(json_text)
                except Exception:
                    parsed = None

            if parsed is None:
                # Could not parse JSON or Python literal -> return raw model text
                return {'dataInfo': data_info, 'preview': preview, 'recommendations_text': model_text}

            # If parsed is a dict containing recommendations key
            if isinstance(parsed, dict) and 'recommendations' in parsed:
                recommendations = parsed['recommendations']
                print(f"[DEBUG] OpenAI returned {len(recommendations)} recommendations")
                
                # Just pass through the recommendations as-is (OpenAI should provide d3_js)
                return {'dataInfo': data_info, 'preview': preview, 'recommendations': recommendations}

            # If parsed is a dict that looks like an API error (common from OpenAI/Azure):
            # {"error": {"message": ..., "type": ..., "code": ...}}
            if isinstance(parsed, dict) and 'error' in parsed:
                err = parsed.get('error') or {}
                model_error = {
                    'code': err.get('code') or err.get('status') or None,
                    'type': err.get('type') or None,
                    'message': err.get('message') or str(err)
                }
                return {'dataInfo': data_info, 'preview': preview, 'recommendations_text': model_text, 'model_error': model_error}

            # If parsed is a list, assume it's the recommendations list
            if isinstance(parsed, list):
                recommendations = parsed
                # Just pass through as-is (OpenAI should provide d3_js)
                return {'dataInfo': data_info, 'preview': preview, 'recommendations': recommendations}

            # Otherwise return raw model text (unknown structure)
            return {'dataInfo': data_info, 'preview': preview, 'recommendations_text': model_text}
        except Exception:
            # Any unexpected parsing error -> return raw model text
            return {'dataInfo': data_info, 'preview': preview, 'recommendations_text': model_text}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/process_h5ad")
async def process_h5ad(file: UploadFile = File(...)):
    import io, pandas as pd, numpy as np, h5py

    NUMERIC_COLS = [
        "nCount_Exon","nCount_RNA","nCount_SCT",
        "nFeature_Exon","nFeature_RNA","nFeature_SCT",
        "percent.mt"
    ]

    def safe_cast(value, dtype='str'):
        if isinstance(value, bytes):
            value = value.decode('utf-8', errors='ignore')
        if value is None or value == b'' or value == '':
            return np.nan if dtype=='float' else ''
        if dtype=='float':
            try:
                return float(value)
            except:
                return np.nan
        return str(value)

    try:
        buf = await file.read()
        with h5py.File(io.BytesIO(buf), 'r') as f:
            obs = f.get('obs')
            if obs is None or not isinstance(obs, h5py.Group):
                return {"error": "obs dataset not found or not a Group"}

            columns = []
            data_dict = {}
            n_rows = 0

            # 1. 先遍历 obs，处理每列/Group
            for col in obs:
                item = obs[col]
                col_data = []

                if isinstance(item, h5py.Dataset):
                    col_data = list(item[()])
                    columns.append(col)
                elif isinstance(item, h5py.Group):
                    # 展开 Group: 每个子 dataset 作为新列
                    for sub in item:
                        sub_item = item[sub]
                        if isinstance(sub_item, h5py.Dataset):
                            sub_col_name = f"{col}.{sub}"
                            columns.append(sub_col_name)
                            col_data_sub = list(sub_item[()])
                            # 补齐长度到当前最大行数
                            n_rows = max(n_rows, len(col_data_sub))
                            data_dict[sub_col_name] = col_data_sub
                    continue  # 已处理子列，不加入 col_data
                else:
                    col_data = []

                # 补齐长度
                n_rows = max(n_rows, len(col_data))
                data_dict[col] = col_data

            # 2. 补齐所有列长度
            for col in data_dict:
                col_len = len(data_dict[col])
                if col_len < n_rows:
                    dtype = 'float' if col in NUMERIC_COLS else 'str'
                    filler = np.nan if dtype=='float' else ''
                    data_dict[col] += [filler] * (n_rows - col_len)

                # 清洗 bytes/空值
                dtype = 'float' if col in NUMERIC_COLS else 'str'
                data_dict[col] = [safe_cast(v, dtype) for v in data_dict[col]]

            df = pd.DataFrame(data_dict)

        # 3. 送给 process_data
        payload = {
            "data": {
                "headers": list(df.columns),
                "rows": df.values.tolist()
            }
        }

        return await process_data(payload)

    except Exception as e:
        return {"error": str(e)}

@app.post("/api/restart_kernel")
async def restart_kernel():
    """Restart the Jupyter kernel"""
    try:
        km = get_kernel_manager()
        result = km.restart_kernel()
        return result
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/kernel_status")
async def kernel_status():
    """Get kernel status"""
    try:
        km = get_kernel_manager()
        return km.get_status()
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/system/info")
async def get_system_info():
    """Get system information (CPU, Memory, GPU)"""
    import platform
    import psutil

    info = {
        "cpu": {
            "name": platform.processor() or "Unknown CPU",
            "cores": psutil.cpu_count(logical=False) or 0,
            "threads": psutil.cpu_count(logical=True) or 0,
            "usage_percent": psutil.cpu_percent(interval=0.1),
        },
        "memory": {
            "total_gb": round(psutil.virtual_memory().total / (1024**3), 1),
            "available_gb": round(psutil.virtual_memory().available / (1024**3), 1),
            "used_percent": psutil.virtual_memory().percent,
        },
        "gpu": None,
        "platform": {
            "system": platform.system(),
            "release": platform.release(),
            "python_version": platform.python_version(),
        }
    }

    # Try to detect GPU
    try:
        import subprocess
        # Try nvidia-smi for NVIDIA GPUs
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            gpu_info = result.stdout.strip().split(",")
            info["gpu"] = {
                "name": gpu_info[0].strip(),
                "memory_mb": int(gpu_info[1].strip()) if len(gpu_info) > 1 else None,
            }
    except Exception:
        # No NVIDIA GPU or nvidia-smi not available
        pass

    # If no NVIDIA GPU, try to detect Apple Silicon
    if info["gpu"] is None and platform.system() == "Darwin":
        try:
            import subprocess
            result = subprocess.run(["sysctl", "-n", "machdep.cpu.brand_string"],
                                    capture_output=True, text=True, timeout=5)
            if "Apple" in result.stdout:
                info["gpu"] = {"name": "Apple Silicon (integrated)", "memory_mb": None}
        except Exception:
            pass

    return info


# -----------------------------
# Notebook helper endpoints
# -----------------------------

def _resolve_notebook_path(path: Optional[str] = None) -> str:
    """Resolve the absolute path to the notebook file.

    Uses the currently selected notebook from NOTEBOOKS_DIR if no path provided.
    """
    global CURRENT_NOTEBOOK
    if path and path.strip():
        return os.path.abspath(path)
    # Use current selected notebook from notebooks directory
    return os.path.join(NOTEBOOKS_DIR, CURRENT_NOTEBOOK)


@app.get("/api/notebook/cells")
async def list_notebook_cells():
    """List code cells from a Jupyter notebook as step candidates.

    Uses the preceding markdown cell as the section title if available.
    """
    nb_path = _resolve_notebook_path()
    if not os.path.exists(nb_path):
        raise HTTPException(status_code=404, detail=f"Notebook not found: {nb_path}")

    try:
        with open(nb_path, "r", encoding="utf-8") as f:
            nb_data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read notebook: {e}")

    cells = nb_data.get("cells", [])
    result = []
    step_index = 0
    last_markdown_title = None  # Track the most recent markdown section title

    for idx, cell in enumerate(cells):
        cell_type = cell.get("cell_type")

        # If it's a markdown cell, extract the title for the next code cell(s)
        if cell_type == "markdown":
            source = cell.get("source", [])
            if isinstance(source, list):
                source_text = "".join(source)
            else:
                source_text = str(source)

            # Extract first heading (## Title) from markdown
            for line in source_text.splitlines():
                line = line.strip()
                if line.startswith("#"):
                    # Remove markdown heading markers and get the title
                    last_markdown_title = line.lstrip("#").strip()
                    break
            continue

        # Skip non-code cells
        if cell_type != "code":
            continue

        source = cell.get("source", [])
        if isinstance(source, list):
            first_line = next((line for line in source if str(line).strip() != ""), "")
        else:
            lines = str(source).splitlines()
            first_line = next((line for line in lines if line.strip() != ""), "")

        # Use markdown title if available, otherwise fall back to code first line
        if last_markdown_title:
            title = last_markdown_title
            description = last_markdown_title
        else:
            title = first_line.strip()
            # Strip leading comment markers for a cleaner title
            if title.startswith("#"):
                title = title.lstrip("#").strip()
            description = title or "Notebook code cell"

        step_index += 1
        result.append({
            "index": idx,               # actual notebook cell index
            "stepNumber": step_index,   # 1-based step sequence among code cells
            "title": title or f"Cell {idx}",
            "description": description,
        })

    return {"notebook": nb_path, "steps": result}


@app.get("/api/notebook/cell/{index}")
async def get_notebook_cell(index: int, path: Optional[str] = None):
    """Fetch the full source of a specific notebook cell by its absolute cell index."""
    nb_path = _resolve_notebook_path(path)
    if not os.path.exists(nb_path):
        raise HTTPException(status_code=404, detail=f"Notebook not found: {nb_path}")

    try:
        with open(nb_path, "r", encoding="utf-8") as f:
            nb_data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read notebook: {e}")

    cells = nb_data.get("cells", [])
    if index < 0 or index >= len(cells):
        raise HTTPException(status_code=404, detail=f"Cell index out of range: {index}")

    cell = cells[index]
    if cell.get("cell_type") != "code":
        raise HTTPException(status_code=400, detail=f"Cell {index} is not a code cell")

    source = cell.get("source", [])
    if isinstance(source, list):
        code = "".join(source)
    else:
        code = str(source)

    return {"index": index, "source": code}


# -----------------------------
# Notebook management endpoints
# -----------------------------

@app.post("/api/notebooks/upload")
async def upload_notebook(file: UploadFile = File(...)):
    """Upload a new Jupyter notebook file"""
    try:
        content = await file.read()

        if USE_AZURE_STORAGE:
            # Upload to Azure Blob Storage
            result = blob_manager.upload_notebook(file.filename, content)

            # Also save to local cache for Jupyter kernel
            os.makedirs(NOTEBOOKS_DIR, exist_ok=True)
            file_path = os.path.join(NOTEBOOKS_DIR, file.filename)
            with open(file_path, "wb") as f:
                f.write(content)

            return result
        else:
            # Fallback: local storage only
            # Validate file extension
            if not file.filename.endswith('.ipynb'):
                raise HTTPException(status_code=400, detail="Only .ipynb files are allowed")

            # Validate file content is valid JSON
            try:
                nb_data = json.loads(content)
                if "cells" not in nb_data or "metadata" not in nb_data:
                    raise HTTPException(status_code=400, detail="Invalid Jupyter notebook format")
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="File is not valid JSON")

            # Ensure notebooks directory exists
            os.makedirs(NOTEBOOKS_DIR, exist_ok=True)

            # Save the file locally
            file_path = os.path.join(NOTEBOOKS_DIR, file.filename)
            with open(file_path, "wb") as f:
                f.write(content)

            # Get file info
            file_stat = os.stat(file_path)

            return {
                "status": "success",
                "filename": file.filename,
                "size": file_stat.st_size,
                "uploaded_at": datetime.fromtimestamp(file_stat.st_mtime).isoformat()
            }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get("/api/notebooks")
async def list_notebooks():
    """List all available notebooks"""
    try:
        if USE_AZURE_STORAGE:
            # Get list from Azure Blob Storage
            notebooks = blob_manager.list_notebooks()

            # Add is_current flag
            for nb in notebooks:
                nb["is_current"] = nb["filename"] == CURRENT_NOTEBOOK

            return {"notebooks": notebooks, "current": CURRENT_NOTEBOOK}
        else:
            # Fallback: local storage
            if not os.path.exists(NOTEBOOKS_DIR):
                return {"notebooks": [], "current": CURRENT_NOTEBOOK}

            notebooks = []
            for filename in os.listdir(NOTEBOOKS_DIR):
                if filename.endswith('.ipynb'):
                    file_path = os.path.join(NOTEBOOKS_DIR, filename)
                    file_stat = os.stat(file_path)
                    notebooks.append({
                        "filename": filename,
                        "size": file_stat.st_size,
                        "modified_at": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                        "is_current": filename == CURRENT_NOTEBOOK
                    })

            # Sort by modified time, most recent first
            notebooks.sort(key=lambda x: x["modified_at"], reverse=True)

            return {"notebooks": notebooks, "current": CURRENT_NOTEBOOK}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list notebooks: {str(e)}")


@app.post("/api/notebooks/select")
async def select_notebook(request: SelectNotebookRequest):
    """Select a notebook as the current active notebook"""
    global CURRENT_NOTEBOOK

    filename = request.filename

    try:
        if USE_AZURE_STORAGE:
            # Download from Azure Blob Storage to local cache
            try:
                content = blob_manager.download_notebook(filename)

                # Ensure local cache directory exists
                os.makedirs(NOTEBOOKS_DIR, exist_ok=True)

                # Save to local cache for Jupyter kernel
                file_path = os.path.join(NOTEBOOKS_DIR, filename)
                with open(file_path, "wb") as f:
                    f.write(content)

            except FileNotFoundError:
                raise HTTPException(status_code=404, detail=f"Notebook not found: {filename}")

        else:
            # Fallback: local storage
            file_path = os.path.join(NOTEBOOKS_DIR, filename)
            if not os.path.exists(file_path):
                raise HTTPException(status_code=404, detail=f"Notebook not found: {filename}")

        # Set as current notebook
        CURRENT_NOTEBOOK = filename

        # Load and return basic info about the selected notebook
        file_path = os.path.join(NOTEBOOKS_DIR, filename)
        with open(file_path, "r", encoding="utf-8") as f:
            nb_data = json.load(f)

        cell_count = len(nb_data.get("cells", []))
        code_cell_count = sum(1 for c in nb_data.get("cells", []) if c.get("cell_type") == "code")

        return {
            "status": "success",
            "current": CURRENT_NOTEBOOK,
            "cell_count": cell_count,
            "code_cell_count": code_cell_count
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to select notebook: {str(e)}")


@app.delete("/api/notebooks/{filename}")
async def delete_notebook(filename: str):
    """Delete a notebook file"""
    global CURRENT_NOTEBOOK

    # Prevent deletion of current notebook
    if filename == CURRENT_NOTEBOOK:
        raise HTTPException(status_code=400, detail="Cannot delete the currently active notebook")

    try:
        if USE_AZURE_STORAGE:
            # Delete from Azure Blob Storage
            result = blob_manager.delete_notebook(filename)

            # Also delete from local cache if exists
            file_path = os.path.join(NOTEBOOKS_DIR, filename)
            if os.path.exists(file_path):
                os.remove(file_path)

            return result
        else:
            # Fallback: local storage
            file_path = os.path.join(NOTEBOOKS_DIR, filename)
            if not os.path.exists(file_path):
                raise HTTPException(status_code=404, detail=f"Notebook not found: {filename}")

            os.remove(file_path)
            return {"status": "success", "message": f"Deleted {filename}"}

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"Notebook not found: {filename}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete notebook: {str(e)}")


@app.get("/api/notebooks/current")
async def get_current_notebook():
    """Get information about the current notebook"""
    try:
        if USE_AZURE_STORAGE:
            # Get metadata from Azure Blob Storage
            try:
                metadata = blob_manager.get_notebook_metadata(CURRENT_NOTEBOOK)
            except FileNotFoundError:
                raise HTTPException(status_code=404, detail="Current notebook not found")

            # Read from local cache to get cell counts
            file_path = os.path.join(NOTEBOOKS_DIR, CURRENT_NOTEBOOK)
            if os.path.exists(file_path):
                with open(file_path, "r", encoding="utf-8") as f:
                    nb_data = json.load(f)
                cell_count = len(nb_data.get("cells", []))
                code_cell_count = sum(1 for c in nb_data.get("cells", []) if c.get("cell_type") == "code")
            else:
                # If not in cache, download and read
                content = blob_manager.download_notebook(CURRENT_NOTEBOOK)
                nb_data = json.loads(content.decode('utf-8'))
                cell_count = len(nb_data.get("cells", []))
                code_cell_count = sum(1 for c in nb_data.get("cells", []) if c.get("cell_type") == "code")

            return {
                "filename": metadata["filename"],
                "size": metadata["size"],
                "modified_at": metadata["modified_at"],
                "cell_count": cell_count,
                "code_cell_count": code_cell_count
            }
        else:
            # Fallback: local storage
            file_path = _resolve_notebook_path()

            if not os.path.exists(file_path):
                raise HTTPException(status_code=404, detail="Current notebook not found")

            file_stat = os.stat(file_path)

            with open(file_path, "r", encoding="utf-8") as f:
                nb_data = json.load(f)

            cell_count = len(nb_data.get("cells", []))
            code_cell_count = sum(1 for c in nb_data.get("cells", []) if c.get("cell_type") == "code")

            return {
                "filename": CURRENT_NOTEBOOK,
                "size": file_stat.st_size,
                "modified_at": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                "cell_count": cell_count,
                "code_cell_count": code_cell_count
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read notebook: {str(e)}")


# -----------------------------
# Workspace file management endpoints
# -----------------------------

@app.post("/api/workspace/upload")
async def upload_workspace_file(file: UploadFile = File(...)):
    """Upload any file to workspace (CSV, JSON, TXT, PY, etc.)"""
    try:
        content = await file.read()

        if USE_AZURE_STORAGE:
            # Upload to Azure uploads container
            result = blob_manager.upload_file(file.filename, content)

            # Also save to local workspace for Jupyter kernel access
            os.makedirs(WORKSPACE_DIR, exist_ok=True)
            file_path = os.path.join(WORKSPACE_DIR, file.filename)
            with open(file_path, "wb") as f:
                f.write(content)

            return result
        else:
            # Fallback: local storage only
            os.makedirs(WORKSPACE_DIR, exist_ok=True)
            file_path = os.path.join(WORKSPACE_DIR, file.filename)

            with open(file_path, "wb") as f:
                f.write(content)

            file_stat = os.stat(file_path)
            return {
                "status": "success",
                "filename": file.filename,
                "size": file_stat.st_size,
                "uploaded_at": datetime.fromtimestamp(file_stat.st_mtime).isoformat()
            }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get("/api/workspace/files")
async def list_workspace_files():
    """List all workspace files"""
    try:
        if USE_AZURE_STORAGE:
            # Get list from Azure uploads container
            files = blob_manager.list_files()
            return {"files": files}
        else:
            # Fallback: local storage
            if not os.path.exists(WORKSPACE_DIR):
                return {"files": []}

            files = []
            for filename in os.listdir(WORKSPACE_DIR):
                file_path = os.path.join(WORKSPACE_DIR, filename)
                if os.path.isfile(file_path):
                    file_stat = os.stat(file_path)
                    files.append({
                        "filename": filename,
                        "size": file_stat.st_size,
                        "modified_at": datetime.fromtimestamp(file_stat.st_mtime).isoformat()
                    })

            # Sort by modified time, most recent first
            files.sort(key=lambda x: x["modified_at"], reverse=True)
            return {"files": files}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")


@app.post("/api/workspace/sync")
async def sync_workspace_files():
    """Sync all files from Azure to local workspace"""
    try:
        if not USE_AZURE_STORAGE:
            return {"status": "skipped", "message": "Azure storage not configured"}

        sync_azure_files_to_local()
        return {"status": "success", "message": "Files synced from Azure"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@app.get("/api/workspace/download/{filename}")
async def download_workspace_file(filename: str):
    """Download a specific file from Azure to local workspace"""
    try:
        if USE_AZURE_STORAGE:
            # Download from Azure
            try:
                content = blob_manager.download_file(filename)
                local_path = os.path.join(WORKSPACE_DIR, filename)
                with open(local_path, 'wb') as f:
                    f.write(content)
                return {"status": "success", "filename": filename, "path": local_path}
            except FileNotFoundError:
                raise HTTPException(status_code=404, detail=f"File not found in Azure: {filename}")
        else:
            # Check local
            local_path = os.path.join(WORKSPACE_DIR, filename)
            if os.path.exists(local_path):
                return {"status": "success", "filename": filename, "path": local_path}
            raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")


@app.delete("/api/workspace/{filename}")
async def delete_workspace_file(filename: str):
    """Delete a workspace file"""
    try:
        if USE_AZURE_STORAGE:
            result = blob_manager.delete_file(filename)

            # Also delete from local cache
            file_path = os.path.join(WORKSPACE_DIR, filename)
            if os.path.exists(file_path):
                os.remove(file_path)

            return result
        else:
            file_path = os.path.join(WORKSPACE_DIR, filename)
            if not os.path.exists(file_path):
                raise HTTPException(status_code=404, detail=f"File not found: {filename}")

            os.remove(file_path)
            return {"status": "success", "message": f"Deleted {filename}"}

    except FileNotFoundError:
        raise HTTPException(status_code=404, detail=f"File not found: {filename}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    # Increase timeout for long-running code execution in low-memory environments
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        timeout_keep_alive=300,  # 5 minutes keep-alive timeout
        workers=1  # Use single worker to save memory
    )