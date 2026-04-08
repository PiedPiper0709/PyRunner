#!/bin/bash
# Quick start script for PyRunner

echo "🚀 Starting PyRunner..."
echo ""

# Check if backend dependencies are installed
echo "📦 Checking backend dependencies..."
if ! python -c "import fastapi" 2>/dev/null; then
    echo "Installing backend dependencies..."
    uv pip install -e . || pip install -e .
fi

# Check if frontend dependencies are installed
if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo ""
echo "✅ Dependencies ready!"
echo ""
echo "Starting services..."
echo "  - Backend: http://localhost:8000"
echo "  - Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Start backend in background
uvicorn backend.main:app --reload --port 8000 &
BACKEND_PID=$!

# Start frontend
cd frontend && npm run dev &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
