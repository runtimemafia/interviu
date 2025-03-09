"use client";

import api from "@/lib/api";
import useAppStore from "@/lib/zustand/appStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const SessionId = () => {
  const router = useRouter();

  const { setSessionId } = useAppStore();

  useEffect(() => {
    api
      .get("/session/new")
      .then((res) => {
        setSessionId(res.data.session_id);
        router.push(`/session/${res.data.session_id}`);
      })
      .catch((err) => {
        console.error(err);
      });
  }, []);

  return <></>;
};

export default SessionId;
