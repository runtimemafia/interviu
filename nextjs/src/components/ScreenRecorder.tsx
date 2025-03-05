import axios from "axios";
import React, { useState, useRef, useEffect } from "react";

const ScreenRecorder = () => {
  const [recording, setRecording] = useState<boolean>(false);
  const [chunkCount, setChunkCount] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef<boolean>(false);
  const recordingStartTimeRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Helper function to get the best supported MIME type
  const getSupportedMimeType = () => {
    const types = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm;codecs=h264,opus",
      "video/mp4;codecs=h264,aac",
      "video/webm",
      "video/mp4",
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log(`Using MIME type: ${type}`);
        return type;
      }
    }

    return "video/webm"; // Fallback
  };

  const startRecording = async () => {
    try {
      // Request screen capture with audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "monitor",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      streamRef.current = stream;
      
      // Connect the stream to the video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
        };
      }

      // Create media recorder with best supported format
      const options = {
        mimeType: getSupportedMimeType(),
        videoBitsPerSecond: 2500000, // 2.5 Mbps for better quality
      };

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      // Set up data handling
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      // Setup what happens when a chunk recording stops
      mediaRecorder.onstop = () => {
        saveChunk();
        // Only start a new chunk if we're still recording
        if (isRecordingRef.current) {
          startNewChunk();
        }
      };

      // Store start time for duration calculation
      recordingStartTimeRef.current = Date.now();

      // Start recording
      mediaRecorder.start();
      setRecording(true);
      isRecordingRef.current = true;
      setChunkCount(0);

      // Set up timer to create 5-second chunks
      chunkTimerRef.current = setInterval(() => {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording" &&
          isRecordingRef.current
        ) {
          // Request data for the last 5 seconds
          mediaRecorderRef.current.requestData();
          // Stop current recording to generate data
          mediaRecorderRef.current.stop();
        }
      }, 10000); // 5 seconds
    } catch (err) {
      console.error("Error starting screen recording:", err);
    }
  };

  const startNewChunk = () => {
    if (
      mediaRecorderRef.current &&
      streamRef.current &&
      isRecordingRef.current
    ) {
      try {
        mediaRecorderRef.current.start();
        console.log("Started new chunk recording");
      } catch (err) {
        console.error("Error starting new chunk:", err);
      }
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      // Request any remaining data
      mediaRecorderRef.current.requestData();
      mediaRecorderRef.current.stop();
    }

    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Clear the video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setRecording(false);
  };

  const saveChunk = async () => {
    if (recordedChunksRef.current.length === 0) return;

    const newChunkCount = chunkCount + 1;
    setChunkCount(newChunkCount);

    // Create blob from recorded chunks
    const blob = new Blob(recordedChunksRef.current, {
      type: mediaRecorderRef.current?.mimeType || "video/webm",
    });

    try {
      // Create FormData to send the blob
      const formData = new FormData();

      // Use appropriate extension based on MIME type
      const fileExtension = mediaRecorderRef.current?.mimeType.includes("mp4")
        ? "mp4"
        : "webm";
      const filename = `screen-recording-chunk-${newChunkCount}.${fileExtension}`;

      // Append the file to the form data
      formData.append("video", blob, filename);

      // Upload the video chunk
      const response = await fetch("http://localhost:8000/upload-video", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(
          `Upload failed: ${response.status} ${response.statusText}`
        );
      }

      console.log(`Chunk ${newChunkCount} uploaded successfully`);
    } catch (error) {
      console.error("Error uploading video chunk:", error);
    }

    // Clear chunks for next recording segment
    recordedChunksRef.current = [];
  };

  // Add a function to convert WebM to MP4 with metadata
  const fixVideoMetadata = (blob: Blob): Promise<Blob> => {
    return new Promise((resolve) => {
      // For now, we just return the original blob
      // In a production app, you could use ffmpeg.wasm or similar to fix metadata
      resolve(blob);
    });
  };

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (chunkTimerRef.current) {
        clearInterval(chunkTimerRef.current);
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div className="screen-recorder">
      <h2 className="text-xl font-bold mb-2">Screen Recorder</h2>
      
      {/* Video preview element */}
      <div className="video-preview mb-4">
        <video
          ref={videoRef}
          className="bg-black w-full max-w-2xl h-auto rounded-lg border border-gray-300"
          muted
          autoPlay
          playsInline
        />
      </div>
      
      <p>Records your screen in 5-second chunks saved to Downloads</p>

      <div className="controls mt-4">
        {!recording ? (
          <button
            onClick={startRecording}
            className="start-btn px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Start Recording
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="stop-btn px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Stop Recording
          </button>
        )}
      </div>

      {recording && (
        <div className="recording-info mt-4 p-4 bg-gray-100 rounded">
          <p className="font-bold">Recording in progress...</p>
          <p>Chunks saved: {chunkCount}</p>
          <p className="text-sm text-gray-600 mt-2">
            Each chunk is approximately 5 seconds. Your video player may not
            show the correct duration, but the content will play correctly.
          </p>
        </div>
      )}

      <div className="mt-4 text-sm text-gray-700">
        <p>
          Note: Some video players may not display the correct duration for WebM
          clips, but the videos should play properly for the full 5 seconds.
        </p>
      </div>

      <div>
        <button
          className="start-btn px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 mt-4"
          onClick={() => {
            axios
              .post("http://localhost:8000/merge-videos")
              .then((response) => {
                console.log("Videos merged successfully");
              })
              .catch((error) => {
                console.error("Error merging videos:", error);
              });
          }}
        >
          Merge videos
        </button>
      </div>
    </div>
  );
};

export default ScreenRecorder;
