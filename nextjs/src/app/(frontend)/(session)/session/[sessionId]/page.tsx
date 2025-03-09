"use client";

import QuestionGenerator from "./QuestionGenerator";
import UploadResume from "./UploadResume";
import Recorder from "./Recorder";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import useQuestionStore from "@/lib/zustand/questionsStore";
import Chart from "@/components/Chart";
import Emotion from "./Emotion";

const NewSession = ({ params }: { params: { sessionId: string } }) => {
  const { setResumeText, confidence, stress } = useQuestionStore();

  useEffect(() => {
    api
      .post("/session/get", {
        sessionId: params.sessionId,
      })
      .then((res) => {
        console.log(res.data.sessionData.resume_text);
        setResumeText(res.data.sessionData.resume_text);
        toast.success("Session started successfully");
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to start session");
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
          <Recorder params={{ sessionId: params.sessionId }} />
        </div>
        <div className="w-[50%] flex flex-col gap-4">
          <UploadResume />
          <QuestionGenerator />
          <Emotion />
        </div>
      </div>
      <Chart
        confidenceData={confidence}
        stressData={stress}
      />
    </>
  );
};

export default NewSession;
