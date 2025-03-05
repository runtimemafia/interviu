import {create} from "zustand";

interface IuseAppStore {

    sessionId: string;
    setSessionId: (sessionId: string) => void;

    supportedMimeType: string;
    setSupportedMimeType: (supportedMimeType: string) => void;

    videoServerHealth: boolean;
    setVideoServerHealth: (serverHealth: boolean) => void;

}

const useAppStore = create<IuseAppStore>((set) => ({

    sessionId: "",
    setSessionId: (sessionId) => set({sessionId}),

    supportedMimeType: "",
    setSupportedMimeType: (supportedMimeType) => set({supportedMimeType}),

    videoServerHealth: false,
    setVideoServerHealth: (videoServerHealth) => set({videoServerHealth}),

}));

export default useAppStore;