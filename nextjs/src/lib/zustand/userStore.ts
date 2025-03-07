import { create } from "zustand";

interface IUseUserStore {
  isLoggedIn: boolean;
  setIsLoggedIn: (isLoggedIn: boolean) => void;
  interviuId: string;
  setInterviuId: (interviuId: string) => void;
}

const useUserStore = create<IUseUserStore>((set) => ({
  interviuId: "",
  setInterviuId: (interviuId) => set({ interviuId }),
  isLoggedIn: false,
  setIsLoggedIn: (isLoggedIn) => set({ isLoggedIn }),
}));


export default useUserStore;