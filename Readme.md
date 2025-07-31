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

## Key Features

### 🔬 Code Execution
- Real Jupyter kernel integration
- Python code execution with state persistence
- Support for matplotlib plots, pandas DataFrames, and text output
- Error handling and display

### 💬 AI Chat Assistant
- OpenAI integration with streaming responses
- WebSocket-based real-time communication
- Context-aware conversations about the analysis

### 📊 Pipeline Structure
- 5-step Alzheimer's analysis workflow
- Interactive step-by-step execution
- Visual status indicators and progress tracking

## API Endpoints

### Code Execution
- `POST /api/execute` - Execute Python code in Jupyter kernel
- `POST /api/restart_kernel` - Restart the kernel
- `GET /api/kernel_status` - Get kernel status

### Chat System
- `WebSocket /ws/chat` - Streaming AI chat interface

## Usage

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

## Dependencies

### Backend Core
- **FastAPI**: Web framework
- **Jupyter Client**: Code execution
- **OpenAI**: AI chat integration
- **Matplotlib/Pandas/NumPy**: Data science libraries

### Frontend Core
- **React 18**: UI framework
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling
- **Lucide React**: Icons

## Development Notes

### Code Standards
- All comments in English
- TypeScript for type safety
- Clean component separation
- Proper error handling

### File Organization
- Removed all unused legacy files
- Clear separation of concerns
- Minimal dependencies
- Well-documented interfaces

## Project Cleaning Summary

### Removed Files
- `CodeView.tsx`, `ResultView.tsx`, `CodeCell.tsx` (unused components)
- `App.js`, `App.css`, `index.js` (legacy JavaScript files)
- `ChatBox.js`, `Navbar.js`, `VisualizationArea.js` (old components)
- Mock data and unused API endpoints

### Simplified Logic
- Removed view mode switching (code/result)
- Eliminated unused step execution logic
- Streamlined component props and interfaces
- Cleaned up import statements

The project is now clean, focused, and maintainable with clear separation between the Jupyter code execution system and the AI chat assistant.