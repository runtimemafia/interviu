"use client";
import { useRouter } from "next/navigation";
import { Calendar1, ChartBar, Video } from "lucide-react";

const TOPCTA = () => {
  const router = useRouter();

  const topCTAs = [
    {
      title: "Start Interview",
      description: "Opens a new meet session",
      icon: Video,
      onClickHandler: () => {
        window.open("https://meet.new", "_blank");
        router.push("/session/new");
      },
    },
    {
      title: "Schedule Interview",
      description: "Schedule a meet for later",
      icon: Calendar1,
      onClickHandler: () => {
        router.push("/session/schedule");
      },
    },
    {
      title: "View Reports",
      description: "Analysis of past interviews",
      icon: ChartBar,
      onClickHandler: () => {
        router.push("/reports");
      },
    },
  ];

  return (
    <div className="flex justify-stretch gap-8">
      {topCTAs.map((cta, index) => {
        return (
          <div
            onClick={cta.onClickHandler}
            key={index}
            className="w-full bg-white hover:bg-primary-100 p-4 px-6 flex items-center  border rounded-xl cursor-pointer
                transition duration-300 ease-in-out
              "
          >
            <cta.icon className="w-10 h-10 mr-4 text-secondary-600" />
            <div>
              <p className="font-medium">{cta.title}</p>
              <p className="opacity-65">{cta.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TOPCTA;
