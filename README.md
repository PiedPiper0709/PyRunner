# PyRunner 🚀

**Python Script Management + Task Execution Platform**

A lightweight, local-first web platform for managing and executing Python scripts with parameter templates, real-time logs, and execution history. Think of it as **Postman for Python scripts**.

---

## ✨ Features

- 📚 **Script Library** - Organize Python scripts with tags, descriptions, and parameter schemas
- 🎯 **Task Runner** - Execute scripts with dynamic parameter forms and real-time output streaming
- 📝 **Parameter Templates** - Save and reuse parameter configurations
- 📊 **Execution History** - Track all task runs with detailed logs and status
- 🔐 **Environment Variables** - Securely store API keys and secrets (base64 encoded)
- ⚡ **WebSocket Streaming** - Real-time log output during script execution
- 🎨 **Modern UI** - Clean interface built with React + Ant Design

---

## 🛠️ Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLModel** - SQL database ORM with Pydantic integration
- **SQLite** - Lightweight embedded database
- **WebSocket** - Real-time bidirectional communication
- **uvicorn** - ASGI server

### Frontend
- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool
- **Ant Design** - Enterprise UI component library
- **Axios** - HTTP client

---

## 📁 Project Structure

```
PyRunner/
├── backend/
│   ├── main.py              # FastAPI application entry point
│   ├── database.py          # SQLite database initialization
│   ├── models.py            # SQLModel data models
│   ├── runner.py            # Script execution engine (subprocess + streaming)
│   └── routers/
│       ├── scripts.py       # Script CRUD endpoints
│       ├── tasks.py         # Task execution & history endpoints
│       ├── templates.py     # Template management endpoints
│       └── envs.py          # Environment variable endpoints
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Main React application
│   │   ├── pages/
│   │   │   ├── ScriptLibrary.tsx   # Script management page
│   │   │   ├── TaskRunner.tsx      # Task execution page
│   │   │   └── TaskHistory.tsx     # Execution history page
│   │   ├── components/
│   │   │   ├── ParamForm.tsx       # Dynamic parameter form
│   │   │   └── LogViewer.tsx       # Real-time log display
│   │   └── api/
│   │       └── client.ts           # API client & types
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
├── scripts/                 # User Python scripts directory
│   ├── hello_world.py       # Example: Simple greeting script
│   └── fetch_url.py         # Example: HTTP request script
├── data/                    # SQLite database storage
│   └── pyrunner.db          # (Auto-generated)
├── pyproject.toml           # Python dependencies (uv)
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+**
- **Node.js 18+** (with npm)
- **uv** (recommended) or pip for Python package management

### Installation

#### 1. Clone the repository

```bash
git clone <repository-url>
cd PyRunner
```

#### 2. Install backend dependencies

Using `uv` (recommended):
```bash
uv pip install -e .
```

Or using pip:
```bash
pip install -e .
```

#### 3. Install frontend dependencies

```bash
cd frontend
npm install
cd ..
```

### Running the Application

#### Start Backend (Terminal 1)

```bash
uvicorn backend.main:app --reload --port 8000
```

Backend will be available at: **http://localhost:8000**

#### Start Frontend (Terminal 2)

```bash
cd frontend
npm run dev
```

Frontend will be available at: **http://localhost:5173**

---

## 📖 Usage Guide

### 1. Script Library

**Create a New Script:**

1. Navigate to **Script Library** page
2. Click **"New Script"** button
3. Fill in the form:
   - **Name**: Display name (e.g., "Fetch API Data")
   - **Description**: What the script does
   - **File Path**: Relative path from `scripts/` directory (e.g., `fetch_url.py`)
   - **Tags**: Comma-separated tags (e.g., `api, network`)
   - **Parameters Schema**: JSON defining script parameters

**Example Parameters Schema:**

```json
{
  "params": [
    {
      "name": "url",
      "type": "string",
      "required": true,
      "description": "URL to fetch"
    },
    {
      "name": "timeout",
      "type": "number",
      "default": 10,
      "description": "Request timeout in seconds"
    },
    {
      "name": "method",
      "type": "select",
      "enum_values": ["GET", "POST", "PUT", "DELETE"],
      "default": "GET",
      "description": "HTTP method"
    }
  ]
}
```

### 2. Task Runner

**Execute a Script:**

1. Select a script from the dropdown
2. Fill in the parameter form (auto-generated from schema)
3. (Optional) Load a saved template
4. Click **"Run Script"**
5. Watch real-time logs stream in

**Save Parameters as Template:**

1. Configure parameters for your script
2. Click **"Save as Template"**
3. Give it a name (e.g., "Production API")
4. Reuse later from the template dropdown

### 3. Task History

- View all past executions
- Filter by script or status
- Click **"View"** to see full logs and parameters
- Track execution time and success/failure status

---

## 🔧 API Endpoints

### Scripts

- `GET /api/scripts` - List all scripts
- `POST /api/scripts` - Create script
- `GET /api/scripts/{id}` - Get script details
- `PUT /api/scripts/{id}` - Update script
- `DELETE /api/scripts/{id}` - Delete script

### Tasks

- `GET /api/tasks` - List execution history
- `POST /api/tasks/run` - Start script execution
- `GET /api/tasks/{id}` - Get task details
- `WS /api/tasks/ws/{id}/logs` - WebSocket for real-time logs

### Templates

- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `DELETE /api/templates/{id}` - Delete template

### Environment Variables

- `GET /api/envs` - List environment variables (values hidden)
- `POST /api/envs` - Create environment variable
- `GET /api/envs/{id}/reveal` - Reveal variable value
- `PUT /api/envs/{id}` - Update variable
- `DELETE /api/envs/{id}` - Delete variable

---

## 📝 Writing Scripts

### Script Requirements

1. **Accept command-line arguments** using `argparse`
2. **Print to stdout/stderr** for logs
3. **Exit with code 0** for success, non-zero for failure

### Example Script

```python
#!/usr/bin/env python3
import argparse

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--name', type=str, required=True)
    parser.add_argument('--count', type=int, default=1)
    args = parser.parse_args()

    for i in range(args.count):
        print(f"Hello {args.name}!")

if __name__ == '__main__':
    main()
```

### Accessing Environment Variables

Environment variables set in PyRunner are automatically available:

```python
import os

api_key = os.getenv('API_KEY')
```

---

## 🎨 Screenshots

### Script Library
*[Placeholder: Screenshot of script cards with tags and descriptions]*

### Task Runner
*[Placeholder: Screenshot of parameter form and run button]*

### Real-time Logs
*[Placeholder: Screenshot of terminal-style log viewer with streaming output]*

### Task History
*[Placeholder: Screenshot of execution history table with filters]*

---

## 🔒 Security Notes

- Environment variables are base64 encoded (not encrypted)
- For production use, consider:
  - Adding proper authentication
  - Using a secrets management service
  - Running behind a reverse proxy with HTTPS

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

---

## 🐛 Troubleshooting

### Backend won't start

- Ensure Python 3.10+ is installed
- Check that all dependencies are installed: `uv pip install -e .`
- Verify port 8000 is not in use

### Frontend won't connect to backend

- Ensure backend is running on port 8000
- Check Vite proxy configuration in `frontend/vite.config.ts`
- Verify CORS settings in `backend/main.py`

### WebSocket connection fails

- Check browser console for errors
- Ensure WebSocket endpoint is accessible
- Verify proxy configuration for `/ws` path

---

## 🚧 Roadmap

- [ ] Script versioning
- [ ] Scheduled task execution (cron-like)
- [ ] Multi-user authentication
- [ ] Script dependencies management
- [ ] Output file attachments
- [ ] Email notifications on task completion
- [ ] Docker deployment support

---

**Built with ❤️ for Python developers who run lots of scripts**
