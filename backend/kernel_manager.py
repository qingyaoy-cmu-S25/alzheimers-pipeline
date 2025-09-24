import asyncio
import base64
import json
import queue
import threading
import time
from typing import Dict, List, Any
from jupyter_client import KernelManager
import logging

# Configure logging for kernel operations
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class JupyterKernelManager:
    """Single global Jupyter kernel manager for code execution"""
    
    def __init__(self):
        self.km = None
        self.kc = None
        self.kernel_id = None
        self._lock = threading.Lock()
        self._initialize_kernel()
    
    def _initialize_kernel(self):
        """Initialize the Jupyter kernel with required libraries"""
        try:
            logger.info("Starting Jupyter kernel...")
            
            # Create kernel manager
            self.km = KernelManager(kernel_name='python3')
            self.km.start_kernel()
            
            # Create kernel client
            self.kc = self.km.client()
            self.kc.start_channels()
            
            # Wait for kernel to be ready
            self.kc.wait_for_ready(timeout=30)
            
            self.kernel_id = self.km.kernel_id
            logger.info(f"Kernel started successfully with ID: {self.kernel_id}")
            
            # Execute initial setup code with required libraries
            setup_code = """
import sys
import matplotlib
matplotlib.use('Agg')  # Use non-interactive backend for server use
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

print("Kernel initialized successfully!")
"""
            self._execute_code_sync(setup_code)
            
        except Exception as e:
            logger.error(f"Failed to initialize kernel: {e}")
            raise
    
    def _execute_code_sync(self, code: str) -> Dict[str, Any]:
        """Execute code synchronously and collect outputs until idle or timeout"""
        with self._lock:
            try:
                # Clear any pending messages
                while True:
                    try:
                        self.kc.get_iopub_msg(timeout=0.1)
                    except queue.Empty:
                        break
                
                # Override plt.show() to capture plots for web display
                setup_show_override = """
import matplotlib.pyplot as plt
import io
import base64
from IPython.display import display, HTML
import builtins
import os as _os
import sys as _sys

def custom_show():
    # Get the current matplotlib figure
    fig = plt.gcf()
    if fig.get_size_inches().sum() > 0:  # Check if figure has content
        # Convert plot to base64 encoded image
        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')
        buf.seek(0)
        img_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        
        # Display as HTML image for web rendering
        html_img = f'<img src="data:image/png;base64,{img_base64}" style="max-width:100%; height:auto;">'
        display(HTML(html_img))
    
    # Clean up figure to prevent memory leaks
    plt.close(fig)

# Replace the default plt.show with our custom implementation
plt.show = custom_show

# Handle process termination commands intelligently
class KernelRestartRequest(Exception):
    pass

def _handle_os_exit(code=0):
    print("Kernel restart requested by os._exit(). The kernel will be restarted.")
    raise KernelRestartRequest("os._exit called")

def _handle_sys_exit(code=0):
    print("Kernel restart requested by sys.exit(). The kernel will be restarted.")
    raise KernelRestartRequest("sys.exit called")

def _handle_quit(*args, **kwargs):
    print("Kernel restart requested by exit()/quit(). The kernel will be restarted.")
    raise KernelRestartRequest("quit/exit called")

_os._exit = _handle_os_exit
_sys.exit = _handle_sys_exit
builtins.exit = _handle_quit
builtins.quit = _handle_quit
"""
                # Execute the override setup
                override_msg_id = self.kc.execute(setup_show_override)
                
                # Wait for override to complete
                while True:
                    try:
                        msg = self.kc.get_iopub_msg(timeout=1)
                        if msg['parent_header'].get('msg_id') == override_msg_id and msg['msg_type'] == 'status' and msg['content']['execution_state'] == 'idle':
                            break
                    except queue.Empty:
                        break
                
                # Execute the actual code
                msg_id = self.kc.execute(code)

                outputs: List[Dict[str, Any]] = []
                status = "ok"

                # Collect all output messages until 'idle' or overall timeout
                overall_timeout_seconds = 300  # 5 minutes per cell
                start_time = time.time()

                while True:
                    try:
                        msg = self.kc.get_iopub_msg(timeout=1)

                        # Skip unrelated messages
                        if msg['parent_header'].get('msg_id') != msg_id:
                            # Still check for overall timeout
                            if time.time() - start_time > overall_timeout_seconds:
                                status = "timeout"
                                outputs.append({
                                    'type': 'error',
                                    'ename': 'TimeoutError',
                                    'evalue': f'Cell execution exceeded {overall_timeout_seconds}s',
                                    'traceback': []
                                })
                                break
                            continue

                        msg_type = msg['msg_type']
                        content = msg['content']

                        if msg_type == 'stream':
                            outputs.append({
                                'type': 'stream',
                                'name': content.get('name'),
                                'content': content.get('text', '')
                            })

                        elif msg_type == 'execute_result':
                            data = content.get('data', {})
                            output = self._process_display_data(data)
                            if output:
                                outputs.append(output)

                        elif msg_type == 'display_data':
                            data = content.get('data', {})
                            output = self._process_display_data(data)
                            if output:
                                outputs.append(output)

                        elif msg_type == 'error':
                            error_name = content.get('ename', 'Error')

                            # Check if this is a kernel restart request
                            if error_name == 'KernelRestartRequest':
                                # Mark that kernel restart is needed
                                status = "restart_needed"
                                outputs.append({
                                    'type': 'stream',
                                    'name': 'stdout',
                                    'content': 'Kernel restart requested. The kernel will be restarted after this cell completes.\n'
                                })
                            else:
                                outputs.append({
                                    'type': 'error',
                                    'ename': error_name,
                                    'evalue': content.get('evalue', ''),
                                    'traceback': content.get('traceback', [])
                                })
                                status = "error"

                        elif msg_type == 'status' and content.get('execution_state') == 'idle':
                            # Execution finished successfully or with errors already captured
                            break

                        # Check overall timeout after processing each message
                        if time.time() - start_time > overall_timeout_seconds:
                            status = "timeout"
                            outputs.append({
                                'type': 'error',
                                'ename': 'TimeoutError',
                                'evalue': f'Cell execution exceeded {overall_timeout_seconds}s',
                                'traceback': []
                            })
                            break

                    except queue.Empty:
                        # No message this tick; check overall timeout
                        if time.time() - start_time > overall_timeout_seconds:
                            status = "timeout"
                            outputs.append({
                                'type': 'error',
                                'ename': 'TimeoutError',
                                'evalue': f'Cell execution exceeded {overall_timeout_seconds}s',
                                'traceback': []
                            })
                            break
                
                return {
                    'outputs': outputs,
                    'status': status
                }
                
            except Exception as e:
                logger.error(f"Error executing code: {e}")
                return {
                    'outputs': [{
                        'type': 'error',
                        'ename': 'ExecutionError',
                        'evalue': str(e),
                        'traceback': [str(e)]
                    }],
                    'status': 'error'
                }
    
    def _process_display_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Process display data and convert to appropriate format"""
        
        # Handle images (matplotlib plots)
        if 'image/png' in data:
            return {
                'type': 'image',
                'content': data['image/png'],
                'format': 'png'
            }
        
        # Handle HTML (pandas DataFrames)
        if 'text/html' in data:
            return {
                'type': 'html',
                'content': data['text/html']
            }
        
        # Handle plain text
        if 'text/plain' in data:
            return {
                'type': 'text',
                'content': data['text/plain']
            }
        
        return None
    
    def execute_code(self, code: str, cell_id: int = None) -> Dict[str, Any]:
        """Execute code and return results"""
        logger.info(f"Executing code for cell {cell_id}")

        # Add cell tracking comment
        if cell_id:
            tracked_code = f"# Cell {cell_id}\n{code}"
        else:
            tracked_code = code

        result = self._execute_code_sync(tracked_code)

        # Check if kernel restart was requested
        if result.get('status') == 'restart_needed':
            logger.info("Kernel restart requested via exit command. Restarting kernel...")

            # Restart the kernel
            self.restart_kernel()

            # Update the result to indicate successful restart
            result['outputs'].append({
                'type': 'stream',
                'name': 'stdout',
                'content': '\n✓ Kernel has been restarted successfully.\n'
            })
            result['outputs'].append({
                'type': 'stream',
                'name': 'stdout',
                'content': 'Note: Previous variables and imports have been cleared. You may need to re-run previous cells.\n'
            })
            result['status'] = 'ok'  # Mark as ok since restart was intentional

        return result

    # Streaming executor removed per user request
    
    def restart_kernel(self) -> Dict[str, str]:
        """Restart the kernel"""
        try:
            logger.info("Restarting kernel...")
            
            # Stop current kernel
            if self.kc:
                self.kc.stop_channels()
            if self.km:
                self.km.shutdown_kernel()
            
            # Wait a moment
            time.sleep(1)
            
            # Reinitialize
            self._initialize_kernel()
            
            return {"status": "restarted"}
        
        except Exception as e:
            logger.error(f"Error restarting kernel: {e}")
            return {"status": "error", "message": str(e)}
    
    def get_status(self) -> Dict[str, Any]:
        """Get kernel status"""
        try:
            if self.km and self.km.is_alive():
                return {
                    "status": "running",
                    "kernel_id": self.kernel_id
                }
            else:
                return {"status": "stopped"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

# Global kernel manager instance
kernel_manager = None

def get_kernel_manager() -> JupyterKernelManager:
    """Get global kernel manager instance"""
    global kernel_manager
    if kernel_manager is None:
        kernel_manager = JupyterKernelManager()
    return kernel_manager