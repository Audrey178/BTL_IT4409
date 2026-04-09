import api from "@/lib/axios";
import { sign } from "crypto";
import { email } from "zod";

export const authService = {
  signUp: async (fullname: string, email: string, password: string) => {
    const res = await api.post(
      "/auth/signup",
      {
        fullname,
        email,
        password,
      },
      { withCredentials: true },
    );

    return res.data;
  },

  signIn: async (email: string, password: string) => {
    const res = await api.post(
      "/auth/signin",
      {
        email,
        password,
      },
      { withCredentials: true },
    );

    return res.data;
  },
};
