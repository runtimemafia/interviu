"use client";

const RecentActivity = () => {
  return (
    <>
      <div className="border p-4 rounded-xl w-[50%]">
        <p className="text-[1.1em] font-semibold">Recent Activity</p>
        <div className="flex flex-col gap-3 mt-4">
          <div className="flex items-center justify-between px-4 pt-2 border-t rounded-md">
            <div>
              <p className="font-semibold">Interview completed</p>
              <p className="opacity-80 font-light">Software Enginee interview with Prakash Raj completed successfully</p>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 pt-2 border-t rounded-md">
            <div>
              <p className="font-semibold">Resume Decoded</p>
              <p className="opacity-80 font-light">Resume of Sarah Johnson decoded successfully.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default RecentActivity;
