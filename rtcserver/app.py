from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
import os
from pathlib import Path
from fastapi import Form, File, UploadFile
from pydantic import BaseModel

app = FastAPI(title="Simple Video Upload Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)


@app.get("/healthcheck")
def healthcheck():
    return {"status": "ok"}



@app.post("/upload-chunk")
async def upload_chunk(
    sessionId: str = Form(...),
    chunkNumber: int = Form(...),
    metadata: str = Form(None),
    video: UploadFile = File(...),
):
    
    # Create directory for this session if it doesn't exist
    session_dir = Path(f"uploads/{sessionId}")
    session_dir.mkdir(parents=True, exist_ok=True)
    
    # Determine file extension from content type or use default
    extension = "mp4"  # Default extension
    if video.content_type == "video/webm":
        extension = "webm"
    
    # Define the path for the chunk file
    chunk_path = session_dir / f"chunk_{chunkNumber}.{extension}"
    
    try:
        # Read and save the file content
        content = await video.read()
        with open(chunk_path, "wb") as f:
            f.write(content)
        
        # If metadata is provided, save it in a separate file
        if metadata:
            metadata_path = session_dir / "metadata.json"
            with open(metadata_path, "w") as f:
                f.write(metadata)
        
        return {
            "status": "success",
            "sessionId": sessionId,
            "chunkNumber": chunkNumber,
            "filePath": str(chunk_path),
            "fileType": extension
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")
