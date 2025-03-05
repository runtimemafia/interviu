"use client";

import { useState, useRef, useEffect } from "react";

const Test = () => {
    const [status, setStatus] = useState<string>("idle");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [uploadStats, setUploadStats] = useState<{chunks: number, failures: number}>({chunks: 0, failures: 0});
    
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const chunkIntervalRef = useRef<any>(null);
    const currentChunkRef = useRef<Blob | null>(null);
    
    const CHUNK_DURATION = 5000; // 5 seconds in milliseconds
    const SERVER_URL = "http://192.168.0.101:5001"; // Update to your server URL
    
    // Clean up function
    const cleanupRecording = () => {
        // Clear interval
        if (chunkIntervalRef.current) {
            clearInterval(chunkIntervalRef.current);
            chunkIntervalRef.current = null;
        }
        
        // Stop media recorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
        }
        
        // Stop all tracks
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        
        // Clear video element
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        
        setStatus("disconnected");
    };

    // Check server health
    const checkServerHealth = async () => {
        try {
            const response = await fetch(`${SERVER_URL}/healthcheck`, {
                method: "GET",
                signal: AbortSignal.timeout(5000)
            });
            
            if (response.ok) {
                return true;
            }
            return false;
        } catch (err) {
            console.error("Server health check failed:", err);
            return false;
        }
    };
    
    // Create a new recording session on the server
    const startSession = async () => {
        try {
            const response = await fetch(`${SERVER_URL}/start-session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    timestamp: Date.now(),
                    metadata: {
                        userAgent: navigator.userAgent,
                        screenWidth: window.screen.width,
                        screenHeight: window.screen.height
                    }
                }),
                signal: AbortSignal.timeout(5000)
            });
            
            if (!response.ok) {
                throw new Error(`Failed to start session: ${await response.text()}`);
            }
            
            const data = await response.json();
            return data.sessionId;
        } catch (err: any) {
            console.error("Error starting session:", err);
            throw new Error(`Failed to start recording session: ${err.message}`);
        }
    };
    
    // Get the supported mime type for this browser
    const getSupportedMimeType = () => {
        // Try different MIME types in order of preference, prioritizing MP4 for compatibility
        const types = [
            'video/mp4',
            'video/mp4;codecs=h264,aac',
            'video/webm;codecs=h264,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm;codecs=vp9,opus',
            'video/webm'
        ];
        
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                console.log(`Browser supports: ${type}`);
                return type;
            }
        }
        
        console.error("No supported media types found");
        return '';
    };

    // Upload a chunk to the server
    const uploadChunk = async (chunk: Blob, chunkNumber: number, sessionIdOverride?: string) => {
        // Use provided session ID override or fall back to state
        const activeSessionId = sessionIdOverride || sessionId;
        
        if (!activeSessionId) {
            console.error("No session ID available for upload");
            return false;
        }
        
        try {
            console.log(`Starting upload for chunk ${chunkNumber}, size: ${chunk.size} bytes, session: ${activeSessionId}`);
            
            // Create form data with the chunk
            const formData = new FormData();
            
            // Get the file extension based on the mime type - default to mp4 for unknown formats
            const fileExtension = chunk.type.includes('webm') ? 'webm' : 'mp4';
            const filename = `chunk-${chunkNumber}.${fileExtension}`;
            
            formData.append("chunk", chunk, filename);
            formData.append("sessionId", activeSessionId);
            formData.append("chunkNumber", chunkNumber.toString());
            formData.append("timestamp", Date.now().toString());
            formData.append("mimeType", chunk.type);
            
            console.log(`Uploading ${filename} to server...`);
            
            // Upload the chunk
            const response = await fetch(`${SERVER_URL}/upload-chunk`, {
                method: "POST",
                body: formData,
                signal: AbortSignal.timeout(30000) // 30-second timeout for uploads
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Server returned error: ${response.status}`, errorText);
                throw new Error(`Failed to upload chunk: ${errorText}`);
            }
            
            console.log(`Chunk ${chunkNumber} upload completed successfully`);
            return true;
        } catch (err) {
            console.error(`Error uploading chunk ${chunkNumber}:`, err);
            return false;
        }
    };
    
    // Start screen recording
    const startScreenRecording = async () => {
        try {
            setStatus("getting screen");
            
            // Capture the session ID at the moment recording starts to avoid race conditions
            const currentSessionId = sessionId;
            if (!currentSessionId) {
                throw new Error("No session ID available to start recording");
            }
            
            // Get screen stream
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { 
                    frameRate: { ideal: 30 }
                },
                audio: true
            });
            
            streamRef.current = screenStream;
            
            // Display stream in video element
            if (videoRef.current) {
                videoRef.current.srcObject = screenStream;
            }
            
            // Handle stream ending (user stops screen sharing)
            screenStream.getVideoTracks()[0].onended = () => {
                console.log("Screen sharing ended by user");
                setStatus("screen sharing ended");
                handleStop();
            };
            
            // Get a supported MIME type
            const mimeType = getSupportedMimeType();
            if (!mimeType) {
                throw new Error("No supported recording format found in this browser");
            }
            
            // Initialize media recorder with supported format
            // Add bitsPerSecond for better quality
            const options = { 
                mimeType,
                videoBitsPerSecond: 2500000, // 2.5 Mbps
                audioBitsPerSecond: 128000   // 128 kbps
            };
            const mediaRecorder = new MediaRecorder(screenStream, options);
            mediaRecorderRef.current = mediaRecorder;
            
            let chunkNumber = 0;
            
            // Handle data available event - triggered when a chunk is completed
            mediaRecorder.ondataavailable = async (event) => {
                console.log("Data available event triggered", event.data.size);
                if (event.data.size > 0) {
                    currentChunkRef.current = event.data;
                    console.log(`Chunk ${chunkNumber} created: ${event.data.size} bytes, type: ${event.data.type}`);
                    
                    try {
                        // Use the captured session ID instead of potentially stale state
                        const success = await uploadChunk(event.data, chunkNumber, currentSessionId);
                        
                        setUploadStats(prev => ({
                            chunks: prev.chunks + 1,
                            failures: prev.failures + (success ? 0 : 1)
                        }));
                        
                        console.log(`Chunk ${chunkNumber} upload ${success ? 'successful' : 'failed'}`);
                        chunkNumber++;
                    } catch (error) {
                        console.error("Error processing chunk:", error);
                    }
                }
            };
            
            // Start recording
            console.log("Starting MediaRecorder with MIME type:", mimeType);
            console.log("Using session ID:", currentSessionId);
            
            // IMPORTANT: Start with a timeslice parameter to ensure chunks are created
            mediaRecorder.start(CHUNK_DURATION);
            setStatus(`recording started (${mimeType})`);
            
            return true;
        } catch (err: any) {
            console.error("Error starting screen recording:", err);
            throw err;
        }
    };
    
    // End the session on the server
    const endSession = async () => {
        if (!sessionId) return;
        
        try {
            await fetch(`${SERVER_URL}/end-session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId,
                    timestamp: Date.now()
                }),
                signal: AbortSignal.timeout(5000)
            });
        } catch (err) {
            console.error("Error ending session:", err);
        }
    };
    
    // Handle start recording
    const handleStart = async () => {
        setErrorMessage("");
        cleanupRecording();
        setUploadStats({chunks: 0, failures: 0});
        setStatus("initializing");
        
        try {
            // Check server health
            setStatus("checking server");
            const serverOk = await checkServerHealth();
            if (!serverOk) {
                throw new Error("Server is not responding. Make sure it's running.");
            }
            
            // Start a new session
            setStatus("starting session");
            const newSessionId = await startSession();
            
            // Set the session ID in state BEFORE starting recording
            setSessionId(newSessionId);
            
            // Small delay to ensure state is updated before starting recording
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Start screen recording
            await startScreenRecording();
            
        } catch (err: any) {
            console.error("Error setting up recording:", err);
            setStatus("error");
            setErrorMessage(err.message || "Failed to start recording");
            cleanupRecording();
        }
    };
    
    // Handle stop recording
    const handleStop = async () => {
        // Capture current session ID before setting status (which might cause race conditions)
        const currentSessionId = sessionId;
        
        setStatus("stopping");
        
        // If there's a media recorder active, stop it to trigger final ondataavailable event
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            console.log("Stopping media recorder to finalize recording");
            try {
                mediaRecorderRef.current.stop();
                
                // Give a little time for the final ondataavailable event to fire
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (e) {
                console.error("Error stopping media recorder:", e);
            }
        }
        
        // End the session with the captured ID
        if (currentSessionId) {
            try {
                await fetch(`${SERVER_URL}/end-session`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        sessionId: currentSessionId,
                        timestamp: Date.now()
                    }),
                    signal: AbortSignal.timeout(5000)
                });
            } catch (err) {
                console.error("Error ending session:", err);
            }
        }
        
        // Clean up resources
        cleanupRecording();
    };

    // Clean up when component unmounts
    useEffect(() => {
        return () => {
            cleanupRecording();
            endSession();
        };
    }, []);

    // Add a debug button to help troubleshoot
    const debugInfo = () => {
        console.log("--- Debug Info ---");
        console.log("Session ID:", sessionId);
        console.log("Status:", status);
        console.log("Upload stats:", uploadStats);
        console.log("MediaRecorder state:", mediaRecorderRef.current?.state);
        console.log("MediaRecorder mime type:", mediaRecorderRef.current?.mimeType);
        console.log("Stream tracks:", streamRef.current?.getTracks().map(t => `${t.kind}: ${t.label} (${t.readyState})`));
        console.log("------------------");
    };

    return (
        <div className="p-4">
            <h1 className="text-xl mb-4">Screen Recording with Chunk Uploads</h1>
            
            <div className="mb-4">Status: {status}</div>
            
            {errorMessage && (
                <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">
                    Error: {errorMessage}
                </div>
            )}
            
            {status === 'recording started' || status.includes('recording started') ? (
                <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">
                    Recording in progress. Chunks: {uploadStats.chunks}, Failed uploads: {uploadStats.failures}
                </div>
            ) : null}
            
            <div className="space-x-2">
                <button 
                    onClick={handleStart}
                    disabled={status.includes("recording") || status === "initializing"}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                >
                    Start Recording
                </button>
                
                <button 
                    onClick={handleStop}
                    disabled={status === "idle" || status === "disconnected" || status === "error"}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                >
                    Stop Recording
                </button>
                
                <button
                    onClick={debugInfo}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                    Debug
                </button>
            </div>
            
            <div className="mt-4 aspect-video border border-gray-300 rounded">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                />
            </div>
            
            <div className="mt-4 text-sm text-gray-600">
                <p>This client captures your screen in 5-second chunks and uploads each chunk to the server.</p>
                <p>The server will stitch these chunks together into a complete recording.</p>
                <p className="mt-2 text-gray-500">
                    Supported formats: {typeof MediaRecorder !== 'undefined' ? 
                        getSupportedMimeType() || "None detected" : 
                        "MediaRecorder not supported in this browser"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                    Using MP4 format when available for maximum browser compatibility.
                </p>
                <p className="text-xs text-gray-400">
                    If uploads aren't working, check the browser console for error messages.
                    Make sure the server endpoints are properly implemented and CORS is configured.
                </p>
            </div>
        </div>
    );
};

export default Test;