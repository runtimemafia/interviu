"use client";

import api from "@/lib/api";
import { useState, useEffect } from "react";

interface Interview {
  id: number;
  status: string;
  date_created: string;
  date_updated: string | null;
  session_id: string;
  start_time: string | null;
  title: string;
  participant_name: string;
  participant_email: string;
  link: string;
  user_interviuId: string;
  scheduled_datetime: string;
}

const UpcomingInterviews = () => {
  const [interviews, setInterviews] = useState<Interview[]>([]);

  useEffect(() => {
    api
      .get("/session/get-scheduled")
      .then((res) => {
        setInterviews(res.data.data);
      })
      .catch((err) => {
        console.log(err);
      });
  }, []);

  return (
    <>
      <div className="border p-4 rounded-xl w-[50%]">
        <p className="text-[1.1em] font-semibold">Upcoming Interviews</p>
        <div className="flex flex-col gap-3 mt-4">
          {interviews && interviews.map((interview, index) => {
            return (
              <div
                key={interview.id}
                onClick={() => {
                  window.open(interview.link, "_blank");
                }}
                className="flex items-center justify-between px-4 py-2 border  rounded-md cursor-pointer hover:bg-gray-100"
              >
                
                <div>
                  <p className="font-semibold">{interview.participant_name}</p>
                  <p className="opacity-65">{interview.title}</p>
                  
                </div>
                <div>
                  <p className="">{new Date(Number(interview.scheduled_datetime)).toDateString()}</p>
                  <p className="opacity-60">{new Date(Number(interview.scheduled_datetime)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default UpcomingInterviews;
