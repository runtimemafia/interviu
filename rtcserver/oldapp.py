import os
import time
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import shutil
from video_utils import fix_webm_timestamps, merge_videos

app = FastAPI(title="Simple Video Upload Service")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Create videos directory if it doesn't exist
UPLOAD_DIR = "videos"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.post("/upload-video/")
async def upload_video(video: UploadFile = File(...)):
    # Check if the file is a video
    if not video.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")
    
    try:
        # Generate epoch timestamp for filename
        timestamp = int(time.time())
        
        # Extract file extension from original filename
        _, ext = os.path.splitext(video.filename)
        
        # Create new filename with timestamp
        new_filename = f"{timestamp}{ext}"
        file_path = os.path.join(UPLOAD_DIR, new_filename)
        
        # Save the file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(video.file, buffer)
        
        # If it's a WebM file, fix the timestamps in the background
        # if ext.lower() == '.webm':
        #     fixed_path = fix_webm_timestamps(file_path)
        #     if fixed_path:
        #         # If fixing was successful, use the fixed file
        #         new_filename = os.path.basename(fixed_path)
        
        return JSONResponse(
            content={
                "success": True,
                "filename": new_filename
            },
            status_code=200
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save video: {str(e)}")

@app.post("/merge-videos/")
async def merge_videos_endpoint(background_tasks: BackgroundTasks):
    """
    Merge all videos in the upload directory into a single file
    """
    try:
        # Run video merging in the background
        output_path = merge_videos(UPLOAD_DIR)
        
        if output_path:
            return JSONResponse(
                content={
                    "success": True,
                    "message": "Video merging started",
                    "output_file": os.path.basename(output_path)
                },
                status_code=200
            )
        else:
            raise HTTPException(status_code=400, detail="Failed to merge videos or no videos found")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error during video merging: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
