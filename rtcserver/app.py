from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import HTTPException
import os
from pathlib import Path
from fastapi import Form, File, UploadFile
from pydantic import BaseModel, FilePath
import json
import datetime
from pazworker import annotate_video

app = FastAPI(title="Simple Video Upload Service")
app.openapi_schema = None

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
    startTime: int = Form(...),
    metadata: str = Form(None),
    video: UploadFile = File(...),
):
    
    # Create directory for this session if it doesn't exist
    session_dir = Path(f"uploads/{sessionId}")
    session_dir.mkdir(parents=True, exist_ok=True)
    
    # Determine file extension from content type or use default
    extension = "mp4"  # Default extension
    if video.content_type.startswith("video/webm"):
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
        
        # Create chunk data dictionary
        chunk_data = {
            "chunkNumber": chunkNumber,
            "startTime": startTime,
            "filePath": str(chunk_path),
            "contentType": video.content_type,
            "fileName": video.filename
        }
        
        # Path to the data.json file
        data_json_path = session_dir / "data.json"
        
        # Load existing data if file exists, or create empty list
        if data_json_path.exists():
            with open(data_json_path, "r") as f:
                chunks_data = json.load(f)
        else:
            chunks_data = []
        
        # Add new chunk data and save back to data.json
        chunks_data.append(chunk_data)
        
        with open(data_json_path, "w") as f:
            json.dump(chunks_data, f, indent=2)

            
        return {"message": "Chunk uploaded successfully", "chunkNumber": chunkNumber, "filePath": str(chunk_path)}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving file: {str(e)}")


class SessionRequest(BaseModel):
    sessionId: str

@app.post("/process-session")
async def process_session(request: SessionRequest):
    # session_id = request.sessionId
    session_id = "36043983-a756-4074-a08b-f3f7344be432"
    session_dir = f"uploads/{session_id}"
    
    # Check if the session directory exists
    if not os.path.exists(session_dir):
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    # Create the output directory
    output_dir = f"{session_dir}/annotated"
    os.makedirs(output_dir, exist_ok=True)
    
    # Find all video chunks in the session directory
    chunks = []
    for file in os.listdir(session_dir):
        if file.startswith("chunk_") and (file.endswith(".webm") or file.endswith(".mp4")):
            chunks.append(file)
    
    if not chunks:
        raise HTTPException(status_code=404, detail=f"No video chunks found for session {session_id}")
    
    # Process the first chunk as a demonstration
    # In a full implementation, you might want to process all chunks
    input_file = f"{session_dir}/{chunks[0]}"
    output_file = f"{output_dir}/{chunks[0]}"
    
    # Start the video processing
    await annotate_video(input_file, output_file)
    
    print(f"Processing session {request.sessionId}")
    return {"message": f"Processing session {session_id}", "processingFile": input_file}