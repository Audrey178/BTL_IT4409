import { User } from "./user";

export interface AuthState {
  accessToken: string | null;
  user: User | null;
  loading: boolean;

  clearState: () => void;

  signUp: (fullname: string, email: string, password: string) => Promise<void>;

  signIn: (email: string, password: string) => Promise<void>;
}
