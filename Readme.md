# Alzheimer's Analysis Pipeline - Project Structure

## Overview
This project is a clean, interactive Jupyter-like notebook system for Alzheimer's disease data analysis with real-time AI chat assistance.

## Architecture

### Frontend (React + TypeScript)
```
src/
├── components/
│   ├── ChatPanel.tsx          # AI chat interface with OpenAI streaming
│   ├── NotebookPanel.tsx      # Main notebook container
│   ├── NotebookView.tsx       # Interactive code cells with Jupyter integration
│   └── PipelinePanel.tsx     # Step selection sidebar
├── lib/
│   └── chat-websocket.ts      # WebSocket client for chat streaming
├── types.ts                   # TypeScript type definitions
├── App.tsx                   # Main application component
└── main.tsx                  # Application entry point
```

### Backend (FastAPI + Python)
```
backend/
├── kernel_manager.py         # Jupyter kernel management
├── models/
│   └── openai_chat.py       # OpenAI streaming chat integration
├── main.py                  # FastAPI server and endpoints
└── requirements.txt         # Python dependencies
```


## API Endpoints

### Code Execution
- `POST /api/execute` - Execute Python code in Jupyter kernel
- `POST /api/restart_kernel` - Restart the kernel
- `GET /api/kernel_status` - Get kernel status

### Chat System
- `WebSocket /ws/chat` - Streaming AI chat interface

## Usage

### Environment Setup
Create a `.env` file in the backend directory with your OpenAI API key:
```bash
cd backend
echo "OPENAI_API_KEY=your_actual_api_key_here" > .env
```

### Start Backend
```bash
cd backend
pip install -r requirements.txt
python main.py
```
Server runs on `http://localhost:8000`

### Start Frontend
```bash
npm install
npm run dev
```
Application runs on `http://localhost:3000`

redeploy 
