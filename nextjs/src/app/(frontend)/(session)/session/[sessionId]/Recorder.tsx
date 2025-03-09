"use client";

import useAppStore from "@/lib/zustand/appStore";
import useQuestionStore from "@/lib/zustand/questionsStore";
import { videoServerHealthCheck } from "@/utils/videoserverutils";
import axios from "axios";
import { useState, useRef, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { webmFixDuration } from "webm-fix-duration";

const Recorder = ({ params }: { params: { sessionId: string } }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [chunksSaved, setChunksSaved] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const [refreshServerHealth, setRefreshServerHealth] = useState(Math.random());

  // Add ref to track recording state for use in interval callbacks
  const isRecordingRef = useRef<boolean>(false);

  // Change how we handle recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const {
    videoServerHealth,
    setVideoServerHealth,
    sessionId,
    setSessionId,
    supportedMimeType,
  } = useAppStore();

  const { addConfidence, addStress, setEmotion } = useQuestionStore();

  // Configuration constants
  const CHUNK_DURATION_MS = 10000; // 10 seconds per chunk

  // Add a ref to track chunk count independently of React state
  const chunkCountRef = useRef<number>(0);

  // Add ref to track the start time of each chunk
  const chunkStartTimeRef = useRef<number>(0);

  if (!sessionId) {
    setSessionId(params.sessionId);
  }

  useEffect(() => {
    const health = videoServerHealthCheck();
    health
      .then((res) => {
        setVideoServerHealth(true);
      })
      .catch((err) => {
        setVideoServerHealth(false);
      });
  }, [refreshServerHealth]);

  const toggleRecording = async () => {
    if (!isRecording) {
      await startRecording();
    } else {
      stopRecording();
    }
    setIsRecording(!isRecording);
    isRecordingRef.current = !isRecording; // Update the ref when state changes
  };

  const captureScreenshot = async (): Promise<Blob | null> => {
    try {
      if (!streamRef.current) {
        console.error("No active stream to capture screenshot from");
        return null;
      }

      // Create a canvas element to draw the video frame
      const canvas = document.createElement("canvas");
      const video = videoRef.current;

      if (!video) {
        console.error("Video element not available");
        return null;
      }

      // Set canvas dimensions to match the video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the current video frame to the canvas
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("Unable to get canvas context");
        return null;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert the canvas to a blob
      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create blob from canvas"));
          }
        }, "image/png");
      });
    } catch (error) {
      console.error("Error capturing screenshot:", error);
      return null;
    }
  };

  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      const screenshot = captureScreenshot();
      screenshot
        .then((res) => {
          if (res) {
            console.log("Screenshot captured successfully");

            // Create a FormData object to send the blob
            const formData = new FormData();
            formData.append(
              "image",
              res,
              `screenshot-${sessionId}-${Date.now()}.png`
            );
            formData.append("sessionId", sessionId || "");

            // Send to backend
            fetch(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/analyze-face`, {
              method: "POST",
              body: formData,
            })
              .then((response) => {
                if (!response.ok) {
                  throw new Error(
                    `Upload failed: ${response.status} ${response.statusText}`
                  );
                }
                return response.json();
              })
              .then(
                (data: {
                  emotion: string;
                  confidence: number;
                  points: number;
                  stress_level: number;
                  confidence_level: number;
                }) => {
                  addConfidence(data.confidence_level);
                  addStress(data.stress_level);
                  setEmotion(data.emotion);
                  console.log("Screenshot uploaded successfully:", data);
                }
              )
              .catch((error) => {
                console.error("Error uploading screenshot:", error);
              });
          } else {
            console.error("Failed to capture screenshot");
          }
        })
        .catch((err) => {
          console.error(err);
        });
    }, 5000);
    return () => clearInterval(interval);
  }, [isRecording, sessionId]);

  // Helper function to get supported mime type if not provided by store
  const getSupportedMimeType = () => {
    if (supportedMimeType) return supportedMimeType;

    const types = [
      "video/mp4;codecs=h264,aac",
      "video/mp4",
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return "video/webm"; // Fallback
  };

  // Format time for display (MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 30 },
        },
        audio: true,
      });

      // Add event listeners to detect when screenshare is stopped at system level
      stream.getTracks().forEach((track) => {
        track.addEventListener("ended", () => {
          console.log("Screen sharing stopped from system level");
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
      chunkStartTimeRef.current = Date.now(); // Initialize the first chunk start time
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
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state === "recording" &&
          isRecordingRef.current
        ) {
          console.log("Stopping chunk recording to save");
          mediaRecorderRef.current.requestData();
          mediaRecorderRef.current.stop();
        }
      }, CHUNK_DURATION_MS);

      // Also set up a timer for UI updates
      durationTimerRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - recordingStartTimeRef.current) / 1000
        );
        setRecordingDuration(elapsed);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
    }
  };

  const startNewChunk = () => {
    if (streamRef.current && mediaRecorderRef.current) {
      try {
        // Record the start time of this chunk
        chunkStartTimeRef.current = Date.now();

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
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
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
      const chunkStartTime = chunkStartTimeRef.current;

      // Create a blob from the chunks
      const mimeType = getSupportedMimeType();
      // const rawBlob = new Blob(recordedChunksRef.current, { type: mimeType });
      const rawBlob = new Blob(recordedChunksRef.current, { type: mimeType });
      const blob = await webmFixDuration(rawBlob, CHUNK_DURATION_MS);

      // Create a unique filename
      const timestamp = new Date().toISOString();
      const fileExtension = mimeType.includes("mp4") ? "mp4" : "webm";
      const filename = `recording-${
        sessionId || "session"
      }-chunk${currentChunkNumber}-${timestamp}.${fileExtension}`;

      // Create a download link
      //  const url = URL.createObjectURL(blob);
      //   const a = document.createElement("a");
      //   a.style.display = "none";
      //   a.href = url;
      //   a.download = filename;

      //   // // Add to DOM, trigger download, and clean up
      //   document.body.appendChild(a);
      //   a.click();
      //   setTimeout(() => {
      //     document.body.removeChild(a);
      //     URL.revokeObjectURL(url);
      //   }, 100);

      // Update counter in React state (for UI)
      setChunksSaved(currentChunkNumber);

      console.log(`Chunk ${currentChunkNumber} saved: ${filename}`);

      // Optional: upload to server with the correct chunk number and start time
      if (videoServerHealth && sessionId) {
        uploadRecordingChunk(
          blob,
          filename,
          currentChunkNumber,
          chunkStartTime
        );
      }

      // Clear chunks for next recording segment
      recordedChunksRef.current = [];
    } catch (error) {
      console.error("Error saving recording chunk:", error);
    }
  };

  // Optional function to upload chunk to server - add startTime parameter
  const uploadRecordingChunk = useCallback(
    async (
      blob: Blob,
      filename: string,
      chunkNumber: number,
      startTime: number
    ) => {
      try {
        const formData = new FormData();
        formData.append("video", blob, filename);
        formData.append("sessionId", sessionId);
        formData.append("duration", CHUNK_DURATION_MS.toString());
        formData.append("chunkNumber", chunkNumber.toString());
        formData.append("startTime", startTime.toString());
        formData.append("startTimeISO", new Date(startTime).toISOString());

        // Replace with your actual API endpoint
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/upload-chunk`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Upload failed: ${response.status} ${response.statusText}`
          );
        }

        console.log(`Chunk ${chunkNumber} uploaded: ${filename}`);

        try {
          axios
            .post("/api/session/update-status", {
              action: "saved",
              sessionId,
              chunkNumber,
              startTime,
            })
            .then((res) => {
              // toast.success("Chunk saved successfully");
            })
            .catch((err) => {
              throw new Error(`Error updating session status: ${err}`);
            });
        } catch (error) {
          console.error("Error updating session status:", error);
        }
      } catch (error) {
        console.error("Error uploading chunk:", error);
      }
    },
    [sessionId]
  ); // Remove chunksSaved from dependencies

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
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startProcessing = useCallback(async () => {
    axios
      .post(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/process-session`, {
        sessionId,
      })
      .then((res) => {
        toast.success("Session processing started");
      })
      .catch((err) => {
        toast.error("Error starting session processing");
      });
  }, [sessionId]);

  return (
    <>
      <div>
        <video
          ref={videoRef}
          className="bg-black w-[35em] h-[20em] rounded-xl"
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
          } text-white px-4 py-2 mt-4 rounded-md disabled:bg-[--color-bg-light] disabled:text-gray-400`}
        >
          {isRecording ? "Stop Recording" : "Start Recording"}
        </button>

        <div
          onClick={() => {
            setRefreshServerHealth(Math.random());
          }}
          className="mt-2 text-sm text-gray-500"
        >
          {isRecording
            ? `Recording in progress (${formatTime(
                recordingDuration
              )}) - ${chunksSaved} chunks saved.`
            : "Click 'Start Recording' to begin."}
        </div>

        {/* <button
          onClick={startProcessing}
          className="bg-[--color-primary] hover:bg-[--color-primary-light] px-4 py-2  rounded-md my-2 mt-6 text-white"
        >
          Start Processing
        </button> */}
      </div>
    </>
  );
};

export default Recorder;
