async def annotate_video(input_file: str, output_file: str):
    """
    Process a video file, detect emotions on the largest face in each frame,
    and annotate the video with the emotion labels while preserving audio,
    quality, and speed.
    
    Args:
        input_file: Path to the input video file (webm or mp4)
        output_file: Path to save the annotated output video
    """
    import cv2
    import numpy as np
    import tempfile
    import os
    import subprocess
    from deepface import DeepFace
    
    # Open the video file
    cap = cv2.VideoCapture(input_file)
    if not cap.isOpened():
        raise ValueError(f"Could not open the input file: {input_file}")
    
    # Get video properties
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Create a temporary file for the annotated video without audio
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_file:
        temp_output = temp_file.name
    
    # Set up the video writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(temp_output, fourcc, fps, (width, height))
    
    frame_count = 0
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
                
            frame_count += 1
            print(f"Processing frame {frame_count}/{total_frames}")
            
            try:
                # Detect faces and emotions using deepface
                results = DeepFace.analyze(
                    img_path=frame,
                    actions=['emotion'],
                    enforce_detection=False,  # Don't raise error if no face is found
                    detector_backend='opencv'  # Faster detection
                )
                
                # Convert to list if it's a dict (single face)
                if isinstance(results, dict):
                    results = [results]
                
                # Find the largest face
                largest_face = None
                max_area = 0
                
                for face_data in results:
                    region = face_data.get('region', {})
                    if not region:
                        continue
                        
                    x, y, w, h = region.get('x', 0), region.get('y', 0), region.get('w', 0), region.get('h', 0)
                    area = w * h
                    
                    if area > max_area:
                        max_area = area
                        largest_face = {
                            'region': region,
                            'emotion': face_data.get('emotion', {})
                        }
                
                # Annotate the largest face if found
                if largest_face:
                    x = largest_face['region']['x']
                    y = largest_face['region']['y']
                    w = largest_face['region']['w']
                    h = largest_face['region']['h']
                    
                    # Draw rectangle around face
                    cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
                    
                    # Get dominant emotion
                    emotions = largest_face['emotion']
                    dominant_emotion = max(emotions.items(), key=lambda x: x[1])[0]
                    emotion_confidence = max(emotions.items(), key=lambda x: x[1])[1]
                    
                    # Put text with emotion
                    text = f"{dominant_emotion}: {emotion_confidence:.1f}%"
                    cv2.putText(frame, text, (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36, 255, 12), 2)
            
            except Exception as e:
                print(f"Error processing frame {frame_count}: {e}")
            
            # Write the processed frame
            out.write(frame)
    
    finally:
        # Release resources
        cap.release()
        out.release()
    
    # Copy audio from input to output using FFmpeg
    try:
        cmd = [
            'ffmpeg', 
            '-i', temp_output,          # Video input (annotated)
            '-i', input_file,           # Original file with audio
            '-c:v', 'copy',             # Copy video stream as is
            '-c:a', 'aac',              # Audio codec
            '-map', '0:v:0',            # Use video from first input
            '-map', '1:a:0',            # Use audio from second input
            '-shortest',                # End when shortest stream ends
            output_file
        ]
        subprocess.run(cmd, check=True)
        
        # Remove temporary file
        os.unlink(temp_output)
        
        return output_file
        
    except Exception as e:
        print(f"Error merging audio: {e}")
        # If audio merging fails, at least return the video without audio
        if os.path.exists(temp_output):
            os.rename(temp_output, output_file)
        return output_file
