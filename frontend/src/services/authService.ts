import api from "@/lib/axios";

export const authService = {
  signUp: async (full_name: string, email: string, password: string) => {
    const res = await api.post(
      "/auth/register",
      {
        full_name,
        email,
        password,
      }
    );

    return res.data;
  },

  signIn: async (email: string, password: string) => {
    const res = await api.post(
      "/auth/login",
      {
        email,
        password,
      }
    );

    return res.data;
  },
};
