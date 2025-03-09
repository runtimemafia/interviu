import { create } from "zustand";

interface IQuestion {
    question: string;
    answer: string;
    children: IQuestion[];
}

interface IQuestionsStore {
    questions : IQuestion[];
    setQuestions: (questions: IQuestion[]) => void;
    baseQuestion: string | null;
    setBaseQuestion: (baseQuestion: string) => void;
    resumeText: string | null;
    setResumeText: (resumeText: string) => void;
    confidence: number[];
    setConfidence: (confidence: number[]) => void;
    stress: number[];
    setStress: (stress: number[]) => void;
    addConfidence: (confidence: number) => void;
    addStress: (stress: number) => void;
    emotion: string | null;
    setEmotion: (emotion: string) => void;

}

const useQuestionStore = create<IQuestionsStore>((set) => ({
    questions: [],
    setQuestions: (questions) => set({questions}),
    baseQuestion: null,
    setBaseQuestion: (baseQuestion) => set({baseQuestion}),
    resumeText: null,
    setResumeText: (resumeText) => set({resumeText}),
    confidence: [],
    setConfidence: (confidence) => set({confidence}),
    stress: [],
    setStress: (stress) => set({stress}),
    addConfidence: (question) => set((state) => ({confidence: [...state.confidence, question]})),
    addStress: (stress) => set((state) => ({stress: [...state.stress, stress]})),
    emotion: null,
    setEmotion: (emotion) => set({emotion})
}));

export default useQuestionStore;