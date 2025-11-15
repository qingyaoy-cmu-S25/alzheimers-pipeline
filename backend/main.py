from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import asyncio
from typing import List, Optional
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from models.openai_chat import get_openai_streaming_response, format_messages
from kernel_manager import get_kernel_manager

app = FastAPI(title="Alzheimer's Analysis Pipeline API")

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
            f"You are a data visualization assistant. Given the following dataset summary:\n"
            f"Rows: {n_rows}, Columns: {n_cols}. Columns (sample): {sample_cols}.\n"
            f"Numeric columns: {numeric_cols}. Categorical columns: {categorical_cols}.\n"
            "Please recommend exactly 3 appropriate chart types for this data. For each recommendation, return a JSON object with keys: name, confidence (0-100), reason (brief), and fields (list of column names to use). Return the final result as a JSON array named 'recommendations'. Do not include extra explanation outside the JSON."
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
            elif isinstance(parsed, list):
                recommendations = parsed
            else:
                # parsed something else (e.g., an error dict) -> return raw text
                return {'dataInfo': data_info, 'preview': preview, 'recommendations_text': model_text}

            return {'dataInfo': data_info, 'preview': preview, 'recommendations': recommendations}
        except Exception:
            # Any unexpected parsing error -> return raw model text
            return {'dataInfo': data_info, 'preview': preview, 'recommendations_text': model_text}

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


## Streaming endpoint removed per user request

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


# -----------------------------
# Notebook helper endpoints
# -----------------------------

def _resolve_notebook_path(path: Optional[str]) -> str:
    """Resolve the absolute path to the notebook file.

    Defaults to the project's root-level 'colab.ipynb' if no path provided.
    This backend typically runs from the 'backend' directory, so we go one level up.
    """
    if path and path.strip():
        return os.path.abspath(path)
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    default_path = os.path.abspath(os.path.join(backend_dir, "..", "colab.ipynb"))
    return default_path


@app.get("/api/notebook/cells")
async def list_notebook_cells(path: Optional[str] = None):
    """List code cells from a Jupyter notebook as step candidates."""
    nb_path = _resolve_notebook_path(path)
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
    for idx, cell in enumerate(cells):
        if cell.get("cell_type") != "code":
            continue
        source = cell.get("source", [])
        if isinstance(source, list):
            first_line = next((line for line in source if str(line).strip() != ""), "")
        else:
            # string
            lines = str(source).splitlines()
            first_line = next((line for line in lines if line.strip() != ""), "")

        title = first_line.strip()
        # Strip leading comment markers for a cleaner title
        if title.startswith("#"):
            title = title.lstrip("#").strip()

        step_index += 1
        result.append({
            "index": idx,               # actual notebook cell index
            "stepNumber": step_index,   # 1-based step sequence among code cells
            "title": title or f"Cell {idx}",
            "description": title or "Notebook code cell",
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