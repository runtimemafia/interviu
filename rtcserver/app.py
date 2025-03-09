from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import HTTPException
import os
from pathlib import Path
from fastapi import Form, File, UploadFile
from pydantic import BaseModel, FilePath
import json
import uvicorn
from dfworkerwebm import annotate_video
from deepface import DeepFace
import cv2
from mtcnn import MTCNN
from PIL import Image
from werkzeug.utils import secure_filename

app = FastAPI(title="Simple Video Upload Service")
app.openapi_schema = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

detector = MTCNN()
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "tiff", "webp", "gif", "heic"}

# Emotion-based scoring system
EMOTION_SCORES = {
    "happy": {"points": 8, "stress": 15, "confidence": 92},     # High positivity, low stress, high confidence.
    "sad": {"points": 4, "stress": 63, "confidence": 25},       # Low positivity, higher stress, low confidence.
    "angry": {"points": 3, "stress": 78, "confidence": 52},     # High arousal negative state, high stress, moderate confidence.
    "surprise": {"points": 7, "stress": 47, "confidence": 58},  # Ambiguous state, moderate stress and confidence.
    "fear": {"points": 2, "stress": 88, "confidence": 22},      # High stress, low confidence, very negative valence.
    "disgust": {"points": 3, "stress": 83, "confidence": 23},   # Similar to fear with high stress and low confidence.
    "neutral": {"points": 5, "stress": 23, "confidence": 48}    # Baseline emotion with balanced values.
}

def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def convert_image(image_path: str) -> str | None:
    """Convert any image format to a standard JPEG format."""
    try:
        img = Image.open(image_path).convert("RGB")
        converted_path = image_path.rsplit('.', 1)[0] + ".jpg"
        img.save(converted_path, "JPEG")
        return converted_path
    except Exception:
        return None

def analyze_emotion(image_path: str) -> dict:
    """Detect the largest face in the image and analyze its emotion."""
    frame = cv2.imread(image_path)
    if frame is None:
        return {"error": "Invalid image"}
    
    faces = detector.detect_faces(frame)
    if not faces:
        return {"error": "No face detected"}
    
    # Find the largest face
    largest_face = max(faces, key=lambda face: face['box'][2] * face['box'][3])
    x, y, w, h = largest_face['box']
    face_img = frame[y:y+h, x:x+w]
    temp_face_path = image_path.replace('.jpg', '_face.jpg')
    cv2.imwrite(temp_face_path, face_img)
    
    try:
        result = DeepFace.analyze(temp_face_path, actions=['emotion'], enforce_detection=False)
        os.remove(temp_face_path)
        
        dominant_emotion = result[0]['dominant_emotion']
        confidence = float(result[0]['emotion'][dominant_emotion])  # Convert to float
        
        # Get emotion-based scores
        emotion_data = EMOTION_SCORES.get(dominant_emotion, {"points": 5, "stress": 50, "confidence": 50})
        
        return {
            "emotion": dominant_emotion,
            "confidence": confidence,
            "points": emotion_data["points"],
            "stress_level": emotion_data["stress"],
            "confidence_level": emotion_data["confidence"]
        }
    except Exception as e:
        return {"error": str(e)}


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
    session_id = "99bca9ec-b76e-4b75-8d1e-d48251e91a4a"
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
    output_file = f"{output_dir}/{chunks[0].replace('.webm', '.mp4')}"
    
    # Start the video processing
    annotate_video(input_file, output_file, f"{session_dir}/emotion_results.csv")
    
    print(f"Processing session {request.sessionId}")
    return {"message": f"Processing session {session_id}", "processingFile": input_file}


@app.get("/chunks-list")
async def list_chunks(sessionId: str):
    session_dir = f"uploads/{sessionId}"
    annotation_dir = f"{session_dir}/annotated"
    
    saved_chunks = []
    for file in os.listdir(session_dir):
        if file.startswith("chunk_") and (file.endswith(".webm") or file.endswith(".mp4")):
            saved_chunks.append(file)
            
    annotated_chunks = []
    for file in os.listdir(annotation_dir):
        if file.startswith("chunk_") and file.endswith(".mp4"):
            annotated_chunks.append(file)
        
    return {"savedChunks": saved_chunks, "annotatedChunks": annotated_chunks}


@app.post("/analyze-face")
async def analyze(image: UploadFile = File(...)):
    if not allowed_file(image.filename):
        raise HTTPException(status_code=400, detail="Invalid file type")
    
    filename = secure_filename(image.filename)
    image_path = f"uploaded_image.{filename.rsplit('.', 1)[1].lower()}"
    
    with open(image_path, "wb") as f:
        f.write(await image.read())
    
    converted_path = convert_image(image_path)
    if not converted_path:
        os.remove(image_path)
        raise HTTPException(status_code=400, detail="Unsupported or corrupted image format")
    
    result = analyze_emotion(converted_path)
    os.remove(image_path)
    os.remove(converted_path)
    
    return JSONResponse(content=result)
            

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)