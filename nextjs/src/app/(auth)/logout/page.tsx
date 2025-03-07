"use client";

import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const Logout = () => {
  const router = useRouter();

  try {
    localStorage.removeItem("token");
    toast.success("Logout successful");
    router.push("/login");
  } catch (e) {
    console.error(e);
    toast.error("Logout failed");
  }

  return (
    <div>
      <h1>Logout</h1>
    </div>
  );
};

export default Logout;
