from fastapi import FastAPI, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Dict, Any, Optional
import os
import uuid
import logging
from datetime import datetime

# Import services
from services.session_manager import SessionManager
from services.video_processor import VideoProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Screen Recording Server")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
session_manager = SessionManager()
video_processor = VideoProcessor()

# Create upload directory if it doesn't exist
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Serve static files (recordings) for debugging
app.mount("/recordings", StaticFiles(directory=UPLOAD_DIR), name="recordings")

# Define request models
class SessionStartRequest(BaseModel):
    timestamp: int
    metadata: Dict[str, Any]

class SessionEndRequest(BaseModel):
    sessionId: str
    timestamp: int


@app.get("/healthcheck")
async def healthcheck():
    """Endpoint to check if the server is running"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.post("/start-session")
async def start_session(request: SessionStartRequest):
    """Start a new recording session"""
    try:
        session_id = str(uuid.uuid4())
        
        # Create session directory
        session_dir = os.path.join(UPLOAD_DIR, session_id)
        os.makedirs(session_dir, exist_ok=True)
        
        # Save session info
        session_manager.create_session(session_id, request.metadata)
        
        logger.info(f"Created new session: {session_id}")
        return {"sessionId": session_id}
    
    except Exception as e:
        logger.error(f"Failed to create session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create session: {str(e)}")


@app.post("/upload-chunk")
async def upload_chunk(
    chunk: UploadFile,
    sessionId: str = Form(...),
    chunkNumber: str = Form(...),
    timestamp: str = Form(...),
    mimeType: str = Form(None)
):
    """Upload a video chunk for a specific session"""
    try:
        if not session_manager.session_exists(sessionId):
            raise HTTPException(status_code=404, detail="Session not found")
        
        chunk_number = int(chunkNumber)
        session_dir = os.path.join(UPLOAD_DIR, sessionId)
        
        # Determine extension based on mime type
        extension = "webm"  # default extension
        if mimeType:
            if "mp4" in mimeType or "video/mp4" in mimeType:
                extension = "mp4"
            elif "webm" in mimeType or "video/webm" in mimeType:
                extension = "webm"
            logger.info(f"Received chunk with mimeType: {mimeType}, using extension: {extension}")
        
        # Ensure the chunk filename is properly formatted and secure
        chunk_filename = f"chunk_{chunk_number:04d}.{extension}"
        chunk_path = os.path.join(session_dir, chunk_filename)
        
        # Save the chunk
        with open(chunk_path, "wb") as f:
            chunk_content = await chunk.read()
            f.write(chunk_content)
            logger.info(f"Wrote {len(chunk_content)} bytes to {chunk_path}")
        
        # Validate the chunk right away
        is_valid = video_processor.check_file_validity(chunk_path)
        logger.info(f"Chunk validity check: {'Valid' if is_valid else 'Invalid'} - {chunk_path}")
        
        # Update session with chunk info
        session_manager.add_chunk(
            sessionId, 
            chunk_number, 
            chunk_path, 
            int(timestamp), 
            mimeType,
            is_valid
        )
        
        logger.info(f"Saved chunk {chunk_number} for session {sessionId} with mimetype {mimeType}")
        return {"status": "success", "chunk": chunk_number, "valid": is_valid}
    
    except Exception as e:
        logger.error(f"Error uploading chunk: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload chunk: {str(e)}")


@app.post("/end-session")
async def end_session(request: SessionEndRequest):
    """End a recording session and trigger video merging"""
    try:
        session_id = request.sessionId
        logger.info(f"Processing end-session request for session: {session_id}")
        
        if not session_manager.session_exists(session_id):
            logger.warning(f"Session not found: {session_id}")
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Get session data
        session_data = session_manager.get_session(session_id)
        session_dir = os.path.join(UPLOAD_DIR, session_id)
        logger.info(f"Found session with {len(session_data.get('chunks', []))} chunks")
        
        # Determine the output format based on the chunks we have
        chunks_info = session_manager.get_chunks_info(session_id)
        
        if not chunks_info:
            logger.warning(f"No chunks found for session {session_id}")
            return {"status": "warning", "message": "No video chunks found to merge"}
        
        # Get only valid chunks
        valid_chunks = [chunk for chunk in chunks_info if chunk.get("is_valid", False)]
        
        if not valid_chunks:
            logger.warning(f"No valid chunks found for session {session_id}")
            return {"status": "warning", "message": "No valid video chunks found to merge"}
        
        # Determine the predominant format from chunks
        mp4_count = sum(1 for chunk in valid_chunks if chunk.get("mime_type") and "mp4" in chunk["mime_type"])
        webm_count = sum(1 for chunk in valid_chunks if chunk.get("mime_type") and "webm" in chunk["mime_type"])
        
        # Choose output format based on the majority of chunks
        output_format = "mp4" if mp4_count > webm_count else "webm"
        output_path = os.path.join(session_dir, f"complete_recording.{output_format}")
        
        logger.info(f"Session {session_id} has {mp4_count} MP4 chunks and {webm_count} WebM chunks")
        logger.info(f"Selected output format: {output_format}")
        
        # Get chunk paths in order, but only for valid chunks
        chunk_paths = [chunk["path"] for chunk in sorted(valid_chunks, key=lambda x: x["number"])]
        
        if not chunk_paths:
            logger.warning(f"No valid chunk paths found for session {session_id}")
            return {"status": "warning", "message": "No valid video chunks found to merge"}
        
        # Merge the video chunks
        logger.info(f"Starting video merge of {len(chunk_paths)} chunks")
        success = await video_processor.merge_chunks(chunk_paths, output_path)
        
        # Mark session as complete regardless of merge success (so we know we tried)
        session_manager.complete_session(session_id, output_path if success else None)
        
        logger.info(f"Session {session_id} completed. Video merged: {success}")
        
        # For debugging, include URLs to access the recordings
        base_url = f"/recordings/{session_id}/"
        result = {
            "status": "success" if success else "error",
            "message": "Video processing completed" if success else "Video processing failed",
            "outputPath": output_path if success else None,
            "format": output_format,
            "debugUrls": {
                "chunks": [f"{base_url}{os.path.basename(path)}" for path in chunk_paths],
                "output": f"{base_url}complete_recording.{output_format}" if success else None
            }
        }
        
        return result
    
    except Exception as e:
        logger.error(f"Error ending session: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to end session: {str(e)}")


@app.get("/session-status/{session_id}")
async def get_session_status(session_id: str):
    """Get the status of a session for debugging"""
    try:
        if not session_manager.session_exists(session_id):
            raise HTTPException(status_code=404, detail="Session not found")
        
        session_data = session_manager.get_session(session_id)
        session_dir = os.path.join(UPLOAD_DIR, session_id)
        
        # Check if completed video exists
        completed_video = None
        output_path = session_data.get("output_path")
        if (output_path and os.path.exists(output_path)):
            completed_video = {
                "path": output_path,
                "size": os.path.getsize(output_path),
                "url": f"/recordings/{session_id}/{os.path.basename(output_path)}"
            }
        
        chunks = session_data.get("chunks", [])
        
        return {
            "id": session_id,
            "completed": session_data.get("completed", False),
            "totalChunks": len(chunks),
            "validChunks": sum(1 for chunk in chunks if chunk.get("is_valid", False)),
            "completedVideo": completed_video,
            "createdAt": session_data.get("created_at"),
            "completedAt": session_data.get("completed_at"),
        }
    
    except Exception as e:
        logger.error(f"Error getting session status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get session status: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
