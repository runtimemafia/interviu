# Screen Recording Server

A FastAPI backend server to handle screen recording uploads from clients, save them as chunks, and merge them into a complete video file.

## Features

- Health check endpoint
- Session management
- Chunk uploading and processing
- Video merging with FFmpeg

## Requirements

- Python 3.8+
- FFmpeg installed on the system

## Installation

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Make sure FFmpeg is installed on your system:

```bash
# For Ubuntu/Debian
sudo apt install ffmpeg

# For macOS
brew install ffmpeg

# For Windows
# Download from https://ffmpeg.org/download.html
```

## Running the Server

```bash
python main.py
```

Or with uvicorn directly:

```bash
uvicorn main:app --host 0.0.0.0 --port 5001 --reload
```

## API Endpoints

- `GET /healthcheck` - Check if the server is running
- `POST /start-session` - Start a new recording session
- `POST /upload-chunk` - Upload a video chunk for a session
- `POST /end-session` - End a session and trigger video merging

## Directory Structure

The server stores uploaded chunks and merged videos in the `uploads` directory, organized by session ID:

```
uploads/
  ├── {session_id}/
  │   ├── chunk_0000.webm
  │   ├── chunk_0001.webm
  │   ├── ...
  │   ├── complete_recording.webm
  │   └── session_info.json
  └── ...
```

## Interacting with the Frontend

This server is designed to work with the provided React frontend. Make sure the frontend is configured to connect to http://localhost:5001.
