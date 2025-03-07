import { Brain } from "lucide-react";
import { ReactNode } from "react";

const DashboardLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div>
      <div className="flex justify-between bg-secondary-100 shadow-sm p-3 px-6">
        <div className="flex items-center">
          <Brain className="h-8 w-8 text-secondary-600" />
          <span className="ml-2 text-xl font-bold text-primary-900">
            Interviu
          </span>
        </div>
      </div>
      <div className="w-full flex flex-col items-center">
        <div className="
        flex flex-col w-[70em]
        ">{children}</div>
      </div>
    </div>
  );
};
export default DashboardLayout;
