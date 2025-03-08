"use client";

import useQuestionStore from "@/lib/zustand/questionsStore";
import axios from "axios";
import { useEffect, useState, useRef } from "react";

const UploadResume = () => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setQuestions, questions, setResumeText } = useQuestionStore();

  useEffect(() => {
    if (resumeFile) {
      const formData = new FormData();
      formData.append("pdf_file", resumeFile);
      //   formData.append("additional_prompt", "");

      axios
        .post(
          `${process.env.NEXT_PUBLIC_AI_SERVER_BASE_URL}/extract_pdf_text`,
          formData
        )
        .then((res) => {
          const resumeData = res.data.text;

          setResumeText(resumeData);

          const formData = new FormData();
          formData.append("resumeData", resumeData);
          formData.append("additional_prompt", "");

          axios
            .post(
              `${process.env.NEXT_PUBLIC_AI_SERVER_BASE_URL}/generate_questions_text`,
              formData
            )
            .then((res2) => {
              console.log(res2.data);
              const questions = res2.data.map((q: string) => {
                return {
                  text: q.replace(/^(\d+\.\s*|-\s*)/, ""),
                  children: [],
                };
              });
              setQuestions(questions);
            })
            .catch((err) => {
              console.error(err);
            });

          setQuestions(questions);
        })
        .catch((err) => {
          console.error(err);
        });
    }
  }, [resumeFile]);

  if (questions.length > 0) {
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileName(file ? file.name : null);
    setResumeFile(file || null);
  };

  return (
    <>
      <div className="border p-4 rounded-md">
        <p className="">
          Upload Candidate's Resume to Start Question Generation
        </p>
        <div className="px-8 py-10 border rounded-lg hover:border-primary-300 cursor-pointer relative mt-4">
          <input
            type="file"
            accept=".pdf"
            className="absolute inset-0 opacity-0 cursor-pointer z-10"
            ref={fileInputRef}
            onChange={handleFileChange}
          />
          <div className="flex items-center text-gray-500">
            {!fileName ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span>Upload Resume (PDF)</span>
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="truncate max-w-[200px]">{fileName}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default UploadResume;
