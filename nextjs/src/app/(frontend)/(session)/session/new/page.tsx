"use client";

import useAppStore from "@/lib/zustand/appStore";
import axios from "axios";
import { useEffect } from "react";
import Recorder from "./Recorder";
import { videoServerHealthCheck } from "@/utils/videoserverutils";
import toast from "react-hot-toast";

const NewSession = () => {
  const { sessionId, setSessionId, setVideoServerHealth } = useAppStore();

  useEffect(() => {
    axios
      .get("/api/session/new")
      .then((res) => {
        setSessionId(res.data.session_id);
      })
      .catch((err) => {
        console.error(err);
      });
    videoServerHealthCheck().then((res) => {
      setVideoServerHealth(true);
    }).catch((err) => {
      toast.error("Video Server Unhealthy");
      setVideoServerHealth(false);
    });
  }, []);

  
  return (
    <>
      <h1>Session ID: {sessionId}</h1>
      <Recorder />
    </>
  );
};

export default NewSession;
