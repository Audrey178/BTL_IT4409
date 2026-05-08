import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import { AuthState } from "@/types/store";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      loading: false,
      isAuthenticated: false,

      clearState: () => {
        set({ accessToken: null, user: null, loading: false, isAuthenticated: false });
      },

      logout: () => {
        set({ accessToken: null, user: null, loading: false, isAuthenticated: false });
      },

      signUp: async (fullname: string, email: string, password: string) => {
        try {
          set({ loading: true });
          const response = await authService.signUp(fullname, email, password);
          if (response.success) {
            toast.success("Sign Up successfully!");
          } else {
            toast.error(response.message || "Sign Up failed");
          }
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
          const response = await authService.signIn(email, password);
          
          if (response.success && response.accessToken && response.user) {
            set({ 
              accessToken: response.accessToken,
              user: response.user,
              isAuthenticated: true,
            });
            toast.success("Sign In successfully!");
          } else {
            toast.error(response.message || "Sign In failed");
          }
        } catch (error: any) {
          console.log(error);
          toast.error(error.response?.data?.message || "Sign In unsuccessfully!");
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
