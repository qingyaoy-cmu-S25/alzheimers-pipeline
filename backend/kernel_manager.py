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
        """Execute code synchronously and collect outputs"""
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
                
                outputs = []
                status = "ok"
                
                # Collect all output messages
                while True:
                    try:
                        msg = self.kc.get_iopub_msg(timeout=10)
                        
                        if msg['parent_header'].get('msg_id') != msg_id:
                            continue
                            
                        msg_type = msg['msg_type']
                        content = msg['content']
                        
                        if msg_type == 'stream':
                            outputs.append({
                                'type': 'stream',
                                'name': content['name'],
                                'content': content['text']
                            })
                        
                        elif msg_type == 'execute_result':
                            # Handle execution results
                            data = content['data']
                            output = self._process_display_data(data)
                            if output:
                                outputs.append(output)
                        
                        elif msg_type == 'display_data':
                            # Handle display data (plots, etc.)
                            data = content['data']
                            output = self._process_display_data(data)
                            if output:
                                outputs.append(output)
                        
                        elif msg_type == 'error':
                            # Handle errors
                            outputs.append({
                                'type': 'error',
                                'ename': content['ename'],
                                'evalue': content['evalue'],
                                'traceback': content['traceback']
                            })
                            status = "error"
                        
                        elif msg_type == 'status' and content['execution_state'] == 'idle':
                            # Execution finished
                            break
                            
                    except queue.Empty:
                        logger.warning("Timeout waiting for kernel output")
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
        
        return self._execute_code_sync(tracked_code)
    
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