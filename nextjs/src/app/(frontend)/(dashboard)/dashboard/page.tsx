"use client";

import RecentActivity from "./RecentActivity";
import TOPCTA from "./topcta";
import UpcomingInterviews from "./UpcomingInterviews";

const Dashboard = () => {
  return (
    <>
      {/* HEADING */}
      <div className="mt-4">
        <p className="text-[1.3em] py-6 font-semibold">Dashboard</p>
      </div>

      {/* TOP CALL TO ACTIONS */}
      <TOPCTA />


      {/* RECENT ACTIVITY */}
      <div className="flex mt-8 items-stretch gap-[2em]">
        <UpcomingInterviews />
        <RecentActivity />
      </div>

    </>
  );
};

export default Dashboard;
