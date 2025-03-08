"use client";

import useQuestionStore from "@/lib/zustand/questionsStore";
import axios from "axios";
import { useState } from "react";

const QuestionGenerator = () => {
  const { questions, baseQuestion, setBaseQuestion, setQuestions, resumeText } =
    useQuestionStore();

  const getChildQuestions = (question: string) => {
    axios
      .post(
        `${process.env.NEXT_PUBLIC_AI_SERVER_BASE_URL}/generate_followup_questions`,
        {
          base_question: question,
        }
      )
      .then((res) => {
        const questions = res.data.map((q: string) => {
          return {
            text: q.replace(/^\d+\.\s*/, ""),
            children: [],
          };
        });
        setBaseQuestion(question);
        setQuestions(questions);
      })
      .catch((err) => {
        console.error(err);
      });
  };

  const restartQuestions = () => {
    const formData = new FormData();
    formData.append("resumeData", resumeText || "");
    formData.append("additional_prompt", "");
    axios
      .post(
        `${process.env.NEXT_PUBLIC_AI_SERVER_BASE_URL}/generate_questions_text`,
        formData
      )
      .then((res) => {
        const questions = res.data.map((q: string) => {
          return {
            text: q.replace(/^(\d+\.\s*|-\s*)/, ""),
            children: [],
          };
        });
        setBaseQuestion("");
        setQuestions(questions);
      })
      .catch((err) => {
        console.error(err);
      });
  };

  return (
    <>
      <div className="border p-4 rounded-md">
        <div className="flex justify-between">
          <p className="text-[1.2em] font-semibold">Questions</p>
          <button
            onClick={restartQuestions}
            className="text-light text-[0.8em]"
          >
            Restart
          </button>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {Boolean(baseQuestion) && (
            <div className="p-3 border rounded-md">{baseQuestion}</div>
          )}
          {questions.map((question, index) => (
            <div
              key={index}
              className="p-3 border rounded-md cursor-pointer hover:border-primary-300 hover:bg-primary-50"
              onClick={() => getChildQuestions(question.text)}
            >
              <p className="text-[1em] font-light">{question.text}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default QuestionGenerator;
