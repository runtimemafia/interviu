"use client";

import api from "@/lib/api";
import axios from "axios";
import { useState } from "react";
import toast from "react-hot-toast";

const ScheduleSession = () => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");

  const handleSubmit = async () => {
    const resumeFileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const resumeFile = resumeFileInput.files?.[0];

    if (!title || !date || !name || !email) {
      alert("Please fill in all required fields");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("date", date);
      formData.append("name", name);
      formData.append("email", email);

      if (resumeFile) {
        formData.append("resume", resumeFile);
      }

      // Import at the top of your file: import axios from "axios";
      const response = await api.post("/session/schedule", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.status === 200) {
        toast.success("Interview scheduled successfully!");
        // Reset form
        setTitle("");
        setDate("");
        setFileName(null);
        setName("");
        setEmail("");
      }
    } catch (error) {
      console.error("Error scheduling interview:", error);
      alert("Failed to schedule interview. Please try again.");
    }
  };

  return (
    <>
      <div className="flex flex-col w-full border rounded-xl p-4 px-8 mt-4">
        <p className="text-[1.3em] mb-[1em] font-semibold">
          Schedule an Interview
        </p>
        <div className="flex flex-col w-full max-w-[30em] gap-[1em]">
          <div>
            <p className="opacity-70 ml-[1em] mb-[0.3em]">Title</p>
            <div className="px-8 py-4 border rounded-lg hover:border-primary-300 cursor-pointer">
              <input
                type="text"
                className="cursor-pointer outline-none w-full"
                placeholder="Flutter Developer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>
          <div>
            <p className="opacity-70 ml-[1em] mb-[0.3em]">Date and Time</p>
            <div className="px-8 py-4 border rounded-lg hover:border-primary-300 cursor-pointer">
              <input
                type="datetime-local"
                className="cursor-pointer outline-none w-full"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <p className="opacity-70 ml-[1em] mb-[0.3em]">Resume (PDF)</p>
            <div className="px-8 py-4 border rounded-lg hover:border-primary-300 cursor-pointer relative">
              <input
                type="file"
                accept=".pdf"
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  setFileName(file ? file.name : null);
                }}
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
          <div>
            <p className="opacity-70 ml-[1em] mb-[0.3em]">
              Candidate Information
            </p>
            <div className="px-8 py-4 border rounded-lg hover:border-primary-300 cursor-pointer">
              <input
                type="text"
                className="cursor-pointer outline-none w-full"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="px-8 py-4 border rounded-lg hover:border-primary-300 cursor-pointer mt-3">
              <input
                type="email"
                className="cursor-pointer outline-none w-full"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div>
            <button
              className="bg-secondary-500 text-white py-3 rounded-lg w-full"
              onClick={handleSubmit}
            >
              Schedule Interview
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ScheduleSession;
