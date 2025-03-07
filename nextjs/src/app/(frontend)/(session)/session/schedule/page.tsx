"use client";

import { useState } from "react";

const ScheduleSession = () => {

    const [fileName, setFileName] = useState<string | null>(null);

  return (
    <>
      <div>
        <p className="text-[1.3em] py-6 font-semibold">Schedule an Interview</p>
        <div className="flex flex-col w-fit gap-[1em]">
        <div>
            <p className="opacity-70 ml-[1em] mb-[0.3em]">Title</p>
            <div className="px-8 py-4 border rounded-lg hover:border-primary-300 cursor-pointer">
              <input type="text" className="cursor-pointer outline-none" placeholder="Flutter Developer" />
            </div>
          </div>
          <div>
          <p className="opacity-70 ml-[1em] mb-[0.3em]">Date and Time</p>
            <div className="px-8 py-4 border rounded-lg hover:border-primary-300 cursor-pointer">
              <input type="datetime-local" className="cursor-pointer outline-none" />
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
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span>Upload Resume (PDF)</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="truncate max-w-[200px]">{fileName}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ScheduleSession;
