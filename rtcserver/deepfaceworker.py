import cv2
import numpy as np
from deepface import DeepFace
from mtcnn import MTCNN

# Load face detector
detector = MTCNN()

# Input & Output video paths
video_path = "input_video.mp4"  # Change to 0 for webcam
output_path = "output_video.mp4"

# Open the video file
cap = cv2.VideoCapture(video_path)

# Get video properties
frame_width = int(cap.get(3))
frame_height = int(cap.get(4))
fps = int(cap.get(cv2.CAP_PROP_FPS))

# Define the video writer
fourcc = cv2.VideoWriter_fourcc(*'mp4v')  # Codec for MP4
out = cv2.VideoWriter(output_path, fourcc, fps, (frame_width, frame_height))

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # Detect faces
    faces = detector.detect_faces(frame)

    if faces:
        # Find the largest face
        largest_face = max(faces, key=lambda face: face['box'][2] * face['box'][3])
        x, y, w, h = largest_face['box']

        # Extract face region
        face_img = frame[y:y+h, x:x+w]

        # Save the face temporarily for DeepFace processing
        cv2.imwrite("temp_face.jpg", face_img)

        try:
            # Analyze the largest face for emotion
            result = DeepFace.analyze("temp_face.jpg", actions=['emotion'], enforce_detection=False)
            emotion = result[0]['dominant_emotion']

            # Draw bounding box and annotate with emotion
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
            cv2.putText(frame, f"Emotion: {emotion}", (x, y - 10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

        except Exception as e:
            print("Error:", e)

    # Write the annotated frame to output video
    out.write(frame)

    # Show video preview
    cv2.imshow("Emotion Recognition", frame)

    # Press 'q' to stop
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Release resources
cap.release()
out.release()
cv2.destroyAllWindows()

print(f"Annotated video saved as: {output_path}")
