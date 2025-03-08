import { create } from "zustand";

interface IQuestion {
    text: string;
    children: IQuestion[];
}

interface IQuestionsStore {
    questions : IQuestion[];
    setQuestions: (questions: IQuestion[]) => void;
    baseQuestion: string | null;
    setBaseQuestion: (baseQuestion: string) => void;
    resumeText: string | null;
    setResumeText: (resumeText: string) => void;
}

const useQuestionStore = create<IQuestionsStore>((set) => ({
    questions: [],
    setQuestions: (questions) => set({questions}),
    baseQuestion: null,
    setBaseQuestion: (baseQuestion) => set({baseQuestion}),
    resumeText: null,
    setResumeText: (resumeText) => set({resumeText}),
}));

export default useQuestionStore;