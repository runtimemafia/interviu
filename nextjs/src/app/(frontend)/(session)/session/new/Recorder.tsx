"use client";

import useAppStore from "@/lib/zustand/appStore";
import { useState, useRef, useEffect, useCallback } from "react";

const Recorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [chunksSaved, setChunksSaved] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  
  // Add ref to track recording state for use in interval callbacks
  const isRecordingRef = useRef<boolean>(false);
  
  // Change how we handle recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  
  const { videoServerHealth, sessionId, supportedMimeType } = useAppStore();
  
  // Configuration constants
  const CHUNK_DURATION_MS = 10000; // 10 seconds per chunk

  // Add a ref to track chunk count independently of React state
  const chunkCountRef = useRef<number>(0);

  const toggleRecording = async () => {
    if (!isRecording) {
      await startRecording();
    } else {
      stopRecording();
    }
    setIsRecording(!isRecording);
    isRecordingRef.current = !isRecording; // Update the ref when state changes
  };

  // Helper function to get supported mime type if not provided by store
  const getSupportedMimeType = () => {
    if (supportedMimeType) return supportedMimeType;
    
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/mp4;codecs=h264,aac',
      'video/webm',
      'video/mp4',
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return 'video/webm'; // Fallback
  };

  // Format time for display (MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      // Add event listeners to detect when screenshare is stopped at system level
      stream.getTracks().forEach(track => {
        track.addEventListener('ended', () => {
          console.log('Screen sharing stopped from system level');
          if (isRecordingRef.current) {
            // Stop recording if it's currently active
            setIsRecording(false);
            isRecordingRef.current = false;
            stopRecording();
          }
        });
      });

      // Store stream in ref for later cleanup
      streamRef.current = stream;

      // Connect stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
        };
      }
      
      // Reset counters and set recording state
      setChunksSaved(0);
      chunkCountRef.current = 0; // Reset chunk count ref
      setRecordingDuration(0);
      recordingStartTimeRef.current = Date.now();
      isRecordingRef.current = true;
      recordedChunksRef.current = []; // Clear any existing chunks
      
      // Create a new MediaRecorder
      const mimeType = getSupportedMimeType();
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      
      // Set up data handling
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      
      // Handle when a chunk recording completes
      mediaRecorderRef.current.onstop = () => {
        saveChunk();
        
        // If still recording, start a new chunk
        if (isRecordingRef.current) {
          startNewChunk();
        }
      };
      
      // Start recording
      mediaRecorderRef.current.start();
      
      // Set up timer to create chunks at regular intervals
      timerIntervalRef.current = setInterval(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording" && isRecordingRef.current) {
          console.log("Stopping chunk recording to save");
          mediaRecorderRef.current.requestData();
          mediaRecorderRef.current.stop();
        }
      }, CHUNK_DURATION_MS);
      
      // Also set up a timer for UI updates
      durationTimerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - recordingStartTimeRef.current) / 1000);
        setRecordingDuration(elapsed);
      }, 1000);
      
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };
  
  const startNewChunk = () => {
    if (streamRef.current && mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.start();
        console.log("Started new chunk recording");
      } catch (err) {
        console.error("Error starting new chunk:", err);
      }
    }
  };

  const stopRecording = () => {
    // Update recording state ref
    isRecordingRef.current = false;
    
    // Stop the media recorder if it's recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.requestData();
      mediaRecorderRef.current.stop();
    }
    
    // Clear timer intervals
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const saveChunk = async () => {
    if (recordedChunksRef.current.length === 0) return;
    
    try {
      // Increment chunk count before saving
      chunkCountRef.current += 1;
      const currentChunkNumber = chunkCountRef.current;
      
      // Create a blob from the chunks
      const mimeType = getSupportedMimeType();
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      
      // Create a unique filename
      const timestamp = new Date().toISOString();
      const fileExtension = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const filename = `recording-${sessionId || 'session'}-chunk${currentChunkNumber}-${timestamp}.${fileExtension}`;
      
      // Create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      
      // Add to DOM, trigger download, and clean up
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      // Update counter in React state (for UI)
      setChunksSaved(currentChunkNumber);
      
      console.log(`Chunk ${currentChunkNumber} saved: ${filename}`);
      
      // Optional: upload to server with the correct chunk number
      if (videoServerHealth && sessionId) {
        uploadRecordingChunk(blob, filename, currentChunkNumber);
      }
      
      // Clear chunks for next recording segment
      recordedChunksRef.current = [];
      
    } catch (error) {
      console.error("Error saving recording chunk:", error);
    }
  };

  // Optional function to upload chunk to server - remove chunksSaved from dependencies
  const uploadRecordingChunk = useCallback(async (blob: Blob, filename: string, chunkNumber: number) => {
    try {
      const formData = new FormData();
      formData.append('video', blob, filename);
      formData.append('sessionId', sessionId);
      formData.append('duration', CHUNK_DURATION_MS.toString());
      formData.append('chunkNumber', chunkNumber.toString());
      
      // Replace with your actual API endpoint
      const response = await fetch('http://localhost:8000/upload-chunk', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }
      
      console.log(`Chunk ${chunkNumber} uploaded: ${filename}`);
    } catch (error) {
      console.error('Error uploading chunk:', error);
    }
  }, [sessionId]); // Remove chunksSaved from dependencies

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
      
      // Stop media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return (
    <>
      <div>
        <video
          ref={videoRef}
          className="bg-black w-[35em] h-[20em] my-[1em] rounded-xl"
          muted
          autoPlay
          playsInline
        />

        <button
          disabled={!videoServerHealth || !Boolean(sessionId)}
          onClick={toggleRecording}
          className={`${
            isRecording
              ? "bg-[--color-bg-light] hover:bg-[--color-bg-lighter]"
              : "bg-[--color-primary] hover:bg-[--color-primary-light]"
          } text-white px-4 py-2 rounded-md disabled:bg-[--color-bg-light] disabled:text-gray-400`}
        >
          {isRecording ? "Stop Recording" : "Start Recording"}
        </button>
        
        <div className="mt-2 text-sm text-gray-500">
          {isRecording 
            ? `Recording in progress (${formatTime(recordingDuration)}) - ${chunksSaved} chunks saved.` 
            : "Click 'Start Recording' to begin."}
        </div>
        
        {isRecording && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
            <p>Saving 10-second video chunks every second. Each chunk contains complete audio and video data.</p>
            <p className="mt-1">Chunks are automatically downloaded to your Downloads folder.</p>
          </div>
        )}
      </div>
    </>
  );
};

export default Recorder;
