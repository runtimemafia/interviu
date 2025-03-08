"use client";

import useAppStore from "@/lib/zustand/appStore";
import axios from "axios";
import { useEffect } from "react";
import Recorder from "./Recorder";
import { videoServerHealthCheck } from "@/utils/videoserverutils";
import toast from "react-hot-toast";
import QuestionGenerator from "./QuestionGenerator";
import UploadResume from "./UploadResume";

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
    videoServerHealthCheck()
      .then((res) => {
        setVideoServerHealth(true);
      })
      .catch((err) => {
        toast.error("Video Server Unhealthy");
        setVideoServerHealth(false);
      });
  }, []);

  return (
    <>
      <div className="flex justify-center p-6 ">
        <p className="text-[1.2em] font-semibold">Interview Analysis</p>
        <button className="ml-auto bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
          End Analysis
        </button>
      </div>
      <div className="flex gap-[2em]">
        <div className="w-[50%]">
          <Recorder />
        </div>
        <div className="w-[50%] flex flex-col gap-4">
          <UploadResume />
          <QuestionGenerator />
        </div>
      </div>
    </>
  );
};

export default NewSession;
