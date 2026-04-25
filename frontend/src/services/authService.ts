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

  logout: async () => {
    const res = await api.post("/auth/logout");
    return res.data;
  },

  refreshToken: async (refresh_token: string) => {
    const res = await api.post("/auth/refresh-token", { refresh_token });
    return res.data;
  },

  getMe: async () => {
    const res = await api.get("/auth/me");
    return res.data;
  },

  updateMe: async (data: Record<string, any>) => {
    const res = await api.put("/auth/me", data);
    return res.data;
  },
};
