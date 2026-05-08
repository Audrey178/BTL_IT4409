import api from "@/lib/axios";
import { User } from "@/types/user";

const normalizeUser = (user: any): User => ({
  _id: user._id,
  full_name: user.full_name ?? user.fullName ?? "",
  email: user.email,
  avatar: user.avatar ?? null,
  role: user.role ?? "user",
  createdAt: user.created_at ?? user.createdAt,
  updatedAt: user.updated_at ?? user.updatedAt,
});

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

    return {
      ...res.data,
      user: res.data.user ? normalizeUser(res.data.user) : null,
      accessToken: res.data.accessToken ?? res.data.access_token ?? null,
      refreshToken: res.data.refreshToken ?? res.data.refresh_token ?? null,
    };
  },

  signIn: async (email: string, password: string) => {
    const res = await api.post(
      "/auth/login",
      {
        email,
        password,
      }
    );

    return {
      ...res.data,
      user: res.data.user ? normalizeUser(res.data.user) : null,
      accessToken: res.data.accessToken ?? res.data.access_token ?? null,
      refreshToken: res.data.refreshToken ?? res.data.refresh_token ?? null,
    };
  },
};
