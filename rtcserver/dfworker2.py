import cv2
import numpy as np
import tensorflow as tf
from deepface import DeepFace
from mtcnn import MTCNN
import multiprocessing
import time
from moviepy import VideoFileClip
import os
import pandas as pd
from tqdm import tqdm

MAX_CORES = 8
num_cores = min(multiprocessing.cpu_count(), MAX_CORES)
print(f"Using {num_cores} CPU cores out of {multiprocessing.cpu_count()} available cores")

# Configure TensorFlow to use limited CPU cores
tf.config.threading.set_inter_op_parallelism_threads(num_cores)

# Optimize OpenCV for multi-threading with limited cores
cv2.setNumThreads(num_cores)

# Input and output video paths
video_path = "input_video.mp4"
temp_output_path = "temp_output.mp4"
final_output_path = "output_video.mp4"
csv_output_path = "emotion_results.csv"
temp_dir = "temp_frames"

# Create temporary directory if it doesn't exist
os.makedirs(temp_dir, exist_ok=True)

# Frame sampling rate (process every 3rd frame)
FRAME_SAMPLE_RATE = 2

def extract_frames(video_path, output_dir):
    """Extract frames from the video for processing"""
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Get video properties
    frame_width = int(cap.get(3))
    frame_height = int(cap.get(4))
    fps = int(cap.get(cv2.CAP_PROP_FPS))
    
    print(f"Extracting frames from video (every {FRAME_SAMPLE_RATE}th frame)...")
    frames_to_process = []
    
    for i in tqdm(range(total_frames)):
        ret, frame = cap.read()
        if not ret:
            break
            
        if i % FRAME_SAMPLE_RATE == 0:
            frame_path = f"{output_dir}/frame_{i:06d}.jpg"
            cv2.imwrite(frame_path, frame)
            frames_to_process.append(i)
    
    cap.release()
    return total_frames, frame_width, frame_height, fps, frames_to_process

def process_frame(frame_path):
    """Process a single frame with emotion detection"""
    frame = cv2.imread(frame_path)
    if frame is None:
        return None

    detector = MTCNN()
    frame_num = int(os.path.basename(frame_path).split('_')[1].split('.')[0])
    
    faces = detector.detect_faces(frame)
    emotion_data = None
    
    if faces:
        largest_face = max(faces, key=lambda face: face['box'][2] * face['box'][3])
        x, y, w, h = largest_face['box']
        face_img = frame[y:y+h, x:x+w]
        temp_face_path = frame_path.replace('.jpg', '_face.jpg')
        cv2.imwrite(temp_face_path, face_img)
        
        try:
            result = DeepFace.analyze(temp_face_path, actions=['emotion'], enforce_detection=False)
            emotion = result[0]['dominant_emotion']
            emotion_scores = result[0]['emotion']
            confidence = emotion_scores[emotion]
            
            emotion_data = {'Frame': frame_num, 'Emotion': emotion, 'Confidence (%)': confidence}
            
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
            cv2.putText(frame, f"{emotion} ({confidence:.1f}%)", (x, y - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            cv2.imwrite(frame_path.replace('.jpg', '_processed.jpg'), frame)
            os.remove(temp_face_path)
        except Exception:
            pass
    
    return emotion_data

def main():
    start_time = time.time()
    
    total_frames, frame_width, frame_height, fps, frames_to_process = extract_frames(video_path, temp_dir)
    print(f"Processing {len(frames_to_process)} frames for emotion detection...")

    frame_paths = [f"{temp_dir}/frame_{i:06d}.jpg" for i in frames_to_process]
    collected_emotion_data = []

    with multiprocessing.Pool(processes=num_cores) as pool:
        results = list(tqdm(pool.imap(process_frame, frame_paths), total=len(frame_paths)))
        
        for result in results:
            if result:
                collected_emotion_data.append(result)
    
    # Save emotions to CSV
    emotion_df = pd.DataFrame(collected_emotion_data)
    emotion_df.to_csv(csv_output_path, index=False)
    print(f"✅ Emotion data saved to {csv_output_path}")

    # Create output video
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(temp_output_path, fourcc, fps, (frame_width, frame_height))

    print("Creating output video with detected emotions...")
    cap = cv2.VideoCapture(video_path)
    
    for i in tqdm(range(total_frames)):
        ret, frame = cap.read()
        if not ret:
            break
        
        if i % FRAME_SAMPLE_RATE == 0:
            processed_path = f"{temp_dir}/frame_{i:06d}_processed.jpg"
            if os.path.exists(processed_path):
                frame = cv2.imread(processed_path)
        
        out.write(frame)
    
    cap.release()
    out.release()
    
    print("Adding audio to the video...")
    try:
        original_video = VideoFileClip(video_path)
        original_audio = original_video.audio

        if original_audio:
            processed_video = VideoFileClip(temp_output_path)
            final_video = processed_video.with_audio(original_audio)
            final_video.write_videofile(final_output_path, codec="libx264", audio_codec="aac", threads=num_cores)
            processed_video.close()
            final_video.close()
            print(f"✅ Final video with audio saved to {final_output_path}")
        else:
            print("⚠️ No audio found, saving video without audio")
            os.rename(temp_output_path, final_output_path)
        
        original_video.close()
    except Exception as e:
        print(f"Error adding audio: {e}")
        os.rename(temp_output_path, final_output_path)

    print("\n--- EMOTION DETECTION RESULTS ---")
    print(f"Total frames analyzed: {len(collected_emotion_data)}")
    print("Emotion detection results saved to 'emotion_results.csv'")

    # Clean up temporary files
    print("Cleaning up temporary files...")
    for file in os.listdir(temp_dir):
        os.remove(os.path.join(temp_dir, file))
    os.rmdir(temp_dir)

    total_time = time.time() - start_time
    print(f"Total processing time: {total_time:.2f} seconds")
    print(f"Frames analyzed: {len(frames_to_process)} (every {FRAME_SAMPLE_RATE}th frame)")
    print(f"Processing speed: {total_frames / total_time:.2f} frames/second")

if __name__ == "__main__":
    main()