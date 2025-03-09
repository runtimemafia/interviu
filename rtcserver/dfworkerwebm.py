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
import subprocess
import sys

MAX_CORES = 9
num_cores = min(multiprocessing.cpu_count(), MAX_CORES)
print(f"Using {num_cores} CPU cores out of {multiprocessing.cpu_count()} available cores")

# Configure TensorFlow to use limited CPU cores
tf.config.threading.set_inter_op_parallelism_threads(num_cores)

# Optimize OpenCV for multi-threading with limited cores
cv2.setNumThreads(num_cores)

# Input and output video paths
# video_path = "input_video.mp4"
video_path="input_video.webm"
temp_output_path = "temp_output.mp4"
final_output_path = "output_video.mp4"
csv_output_path = "emotion_results.csv"
temp_dir = "temp_frames"
converted_video_path = "converted_input.mp4"  # Path for converted webm files

# Create temporary directory if it doesn't exist
os.makedirs(temp_dir, exist_ok=True)

# Frame sampling rate (process every 3rd frame)
FRAME_SAMPLE_RATE = 2

def convert_webm_to_mp4(webm_path, mp4_path):
    """Convert webm file to mp4 format using ffmpeg directly"""
    print(f"Converting webm file to mp4 format...")
    try:
        # First try with moviepy
        try:
            video = VideoFileClip(webm_path)
            video.write_videofile(mp4_path, audio_codec="aac", threads=num_cores, fps=30)
            video.close()
            print(f"✅ Converted webm to mp4 using MoviePy: {mp4_path}")
            return True
        except Exception as e:
            print(f"MoviePy conversion failed: {e}")
            
        # Fallback to direct ffmpeg call
        print("Trying direct ffmpeg conversion...")
        result = subprocess.run(
            ["ffmpeg", "-i", webm_path, "-c:v", "libx264", "-c:a", "aac", "-y", mp4_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        if result.returncode == 0 and os.path.exists(mp4_path) and os.path.getsize(mp4_path) > 0:
            print(f"✅ Converted webm to mp4 using ffmpeg: {mp4_path}")
            return True
        else:
            print(f"ffmpeg error: {result.stderr.decode()}")
            return False
            
    except Exception as e:
        print(f"Error converting webm to mp4: {e}")
        return False

def extract_frames(video_path, output_dir):
    """Extract frames from the video for processing"""
    try:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            print(f"Error: Could not open video file {video_path}")
            return 0, 0, 0, 0, []
            
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0:
            print(f"Error: Video has no frames or frame count couldn't be determined")
            return 0, 0, 0, 0, []
        
        # Get video properties
        frame_width = int(cap.get(3))
        frame_height = int(cap.get(4))
        fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30  # Default to 30fps if detection fails
        
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
    except Exception as e:
        print(f"Error extracting frames: {e}")
        return 0, 0, 0, 0, []

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
    
    # Check if input file exists
    if not os.path.exists(video_path):
        print(f"Error: Input file {video_path} does not exist")
        return
    
    # Check if input is webm and convert if necessary
    input_file_to_process = video_path
    is_converted = False
    
    if video_path.lower().endswith('.webm'):
        print(f"Detected webm file: {video_path}")
        if convert_webm_to_mp4(video_path, converted_video_path):
            input_file_to_process = converted_video_path
            is_converted = True
        else:
            print("Failed to convert webm file. Will attempt to process original file.")
    
    total_frames, frame_width, frame_height, fps, frames_to_process = extract_frames(input_file_to_process, temp_dir)
    
    # Check if frames were successfully extracted
    if total_frames == 0 or not frames_to_process:
        print("Failed to extract frames from video. Exiting.")
        # Clean up any partial temp files
        if os.path.exists(temp_dir):
            for file in os.listdir(temp_dir):
                os.remove(os.path.join(temp_dir, file))
            os.rmdir(temp_dir)
        if is_converted and os.path.exists(converted_video_path):
            os.remove(converted_video_path)
        return
    
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
    
    # Check if CSV file already exists
    if os.path.exists(csv_output_path) and os.path.getsize(csv_output_path) > 0:
        # Append data without writing header
        emotion_df.to_csv(csv_output_path, mode='a', header=False, index=False)
        print(f"✅ Appended emotion data to existing {csv_output_path}")
    else:
        # Create new file with header
        emotion_df.to_csv(csv_output_path, index=False)
        print(f"✅ Created new emotion data file: {csv_output_path}")

    # Create output video
    try:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(temp_output_path, fourcc, fps, (frame_width, frame_height))

        print("Creating output video with detected emotions...")
        cap = cv2.VideoCapture(input_file_to_process)
        
        for i in tqdm(range(total_frames)):
            ret, frame = cap.read()
            if not ret:
                break
            
            if i % FRAME_SAMPLE_RATE == 0:
                processed_path = f"{temp_dir}/frame_{i:06d}_processed.jpg"
                if os.path.exists(processed_path):
                    processed_frame = cv2.imread(processed_path)
                    if processed_frame is not None:
                        frame = processed_frame
            
            out.write(frame)
        
        cap.release()
        out.release()
        
        # Verify that the temp output file was created
        if not os.path.exists(temp_output_path) or os.path.getsize(temp_output_path) == 0:
            raise Exception("Failed to create temporary output video")
        
        print("Adding audio to the video...")
        try:
            original_video = VideoFileClip(input_file_to_process)
            original_audio = original_video.audio

            if original_audio:
                processed_video = VideoFileClip(temp_output_path)
                final_video = processed_video.with_audio(original_audio)
                final_video.write_videofile(final_output_path, codec="libx264", audio_codec="aac", threads=num_cores)
                processed_video.close()
                final_video.close()
                print(f"✅ Final video with audio saved to {final_output_path}")
            else:
                print("⚠ No audio found, saving video without audio")
                if os.path.exists(temp_output_path):
                    os.rename(temp_output_path, final_output_path)
                else:
                    print(f"Error: Temporary output file {temp_output_path} not found")
            
            original_video.close()
        except Exception as e:
            print(f"Error adding audio: {e}")
            # Still try to save the video without audio if possible
            if os.path.exists(temp_output_path):
                os.rename(temp_output_path, final_output_path)
                print(f"✅ Output video without audio saved to {final_output_path}")
            else:
                print(f"Error: Temporary output file {temp_output_path} not found")
    
    except Exception as e:
        print(f"Error creating output video: {e}")

    print("\n--- EMOTION DETECTION RESULTS ---")
    print(f"Total frames analyzed: {len(collected_emotion_data)}")
    print("Emotion detection results saved to 'emotion_results.csv'")

    # Clean up temporary files
    print("Cleaning up temporary files...")
    if os.path.exists(temp_dir):
        for file in os.listdir(temp_dir):
            os.remove(os.path.join(temp_dir, file))
        os.rmdir(temp_dir)
    
    # Remove converted file if it exists
    if is_converted and os.path.exists(converted_video_path):
        os.remove(converted_video_path)
        print(f"Removed temporary converted file: {converted_video_path}")

    # Remove temp output if it exists
    if os.path.exists(temp_output_path):
        os.remove(temp_output_path)

    total_time = time.time() - start_time
    print(f"Total processing time: {total_time:.2f} seconds")
    print(f"Frames analyzed: {len(frames_to_process)} (every {FRAME_SAMPLE_RATE}th frame)")
    if total_frames > 0:
        print(f"Processing speed: {total_frames / total_time:.2f} frames/second")


def annotate_video(input_file, output_file, csv_output):
    start_time = time.time()
    
    # Check if input file exists
    if not os.path.exists(input_file):
        print(f"Error: Input file {input_file} does not exist")
        return
    
    # Check if input is webm and convert if necessary
    input_file_to_process = input_file
    is_converted = False
    
    if input_file.lower().endswith('.webm'):
        print(f"Detected webm file: {input_file}")
        if convert_webm_to_mp4(input_file, converted_video_path):
            input_file_to_process = converted_video_path
            is_converted = True
        else:
            print("Failed to convert webm file. Will attempt to process original file.")
    
    total_frames, frame_width, frame_height, fps, frames_to_process = extract_frames(input_file_to_process, temp_dir)
    
    # Check if frames were successfully extracted
    if total_frames == 0 or not frames_to_process:
        print("Failed to extract frames from video. Exiting.")
        # Clean up any partial temp files
        if os.path.exists(temp_dir):
            for file in os.listdir(temp_dir):
                os.remove(os.path.join(temp_dir, file))
            os.rmdir(temp_dir)
        if is_converted and os.path.exists(converted_video_path):
            os.remove(converted_video_path)
        return
    
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
    emotion_df.to_csv(csv_output, index=False)
    print(f"✅ Emotion data saved to {csv_output}")

    # Create output video
    try:
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(temp_output_path, fourcc, fps, (frame_width, frame_height))

        print("Creating output video with detected emotions...")
        cap = cv2.VideoCapture(input_file_to_process)
        
        for i in tqdm(range(total_frames)):
            ret, frame = cap.read()
            if not ret:
                break
            
            if i % FRAME_SAMPLE_RATE == 0:
                processed_path = f"{temp_dir}/frame_{i:06d}_processed.jpg"
                if os.path.exists(processed_path):
                    processed_frame = cv2.imread(processed_path)
                    if processed_frame is not None:
                        frame = processed_frame
            
            out.write(frame)
        
        cap.release()
        out.release()
        
        # Verify that the temp output file was created
        if not os.path.exists(temp_output_path) or os.path.getsize(temp_output_path) == 0:
            raise Exception("Failed to create temporary output video")
        
        print("Adding audio to the video...")
        try:
            original_video = VideoFileClip(input_file_to_process)
            original_audio = original_video.audio

            if original_audio:
                processed_video = VideoFileClip(temp_output_path)
                final_video = processed_video.with_audio(original_audio)
                final_video.write_videofile(output_file, codec="libx264", audio_codec="aac", threads=num_cores)
                processed_video.close()
                final_video.close()
                print(f"✅ Final video with audio saved to {output_file}")
            else:
                print("⚠ No audio found, saving video without audio")
                if os.path.exists(temp_output_path):
                    os.rename(temp_output_path, output_file)
                else:
                    print(f"Error: Temporary output file {temp_output_path} not found")
            
            original_video.close()
        except Exception as e:
            print(f"Error adding audio: {e}")
            # Still try to save the video without audio if possible
            if os.path.exists(temp_output_path):
                os.rename(temp_output_path, output_file)
                print(f"✅ Output video without audio saved to {output_file}")
            else:
                print(f"Error: Temporary output file {temp_output_path} not found")
    
    except Exception as e:
        print(f"Error creating output video: {e}")

    print("\n--- EMOTION DETECTION RESULTS ---")
    print(f"Total frames analyzed: {len(collected_emotion_data)}")
    print("Emotion detection results saved to 'emotion_results.csv'")

    # Clean up temporary files
    print("Cleaning up temporary files...")
    if os.path.exists(temp_dir):
        for file in os.listdir(temp_dir):
            os.remove(os.path.join(temp_dir, file))
        os.rmdir(temp_dir)
    
    # Remove converted file if it exists
    if is_converted and os.path.exists(converted_video_path):
        os.remove(converted_video_path)
        print(f"Removed temporary converted file: {converted_video_path}")

    # Remove temp output if it exists
    if os.path.exists(temp_output_path):
        os.remove(temp_output_path)

    total_time = time.time() - start_time
    print(f"Total processing time: {total_time:.2f} seconds")
    print(f"Frames analyzed: {len(frames_to_process)} (every {FRAME_SAMPLE_RATE}th frame)")
    if total_frames > 0:
        print(f"Processing speed: {total_frames / total_time:.2f} frames/second")

if __name__ == "__main__":
    main()