"use client";

import useQuestionStore from "@/lib/zustand/questionsStore";

const Emotion = () => {

    const {emotion} = useQuestionStore();

  return (
    <div className="flex p-6 rounded-md border">
      <p><span className="font-light">Last emotion:</span> {emotion?.toLocaleUpperCase()}</p>
    </div>
  );
};

export default Emotion;