import { create } from "zustand";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import { AuthState } from "@/types/store";

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  user: null,
  loading: false,

  clearState: () => {
    set({ accessToken: null, user: null, loading: false });
  },

  logout: () => {
    set({ accessToken: null, user: null });
    toast.success("Logged out successfully!");
  },

  signUp: async (fullname: string, email: string, password: string) => {
    try {
      set({ loading: true });

      await authService.signUp(fullname, email, password);
      toast.success("Sign Up successfully!");
    } catch (error) {
      console.log(error);
      toast.error("Sign Up unsuccessfully!");
    } finally {
      set({ loading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      set({ loading: true });

      const { accessToken } = await authService.signIn(email, password);
      set({ accessToken: accessToken });

      toast.success("Sign Ip successfully!");
    } catch (error) {
      console.log(error);
      toast.error("Sign Ip unsuccessfully!");
    } finally {
      set({ loading: false });
    }
  },
}));
