export interface User {
  _id: string;
  full_name: string;
  email: string;
  avatar?: string | null;
  role?: "user" | "admin";
  createdAt?: string;
  updatedAt?: string;
}
