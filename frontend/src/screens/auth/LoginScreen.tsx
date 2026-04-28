import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, Apple, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/stores/useAuthStore";
import z from "zod";
import { useState } from "react";

const signInSchema = z.object({
  email: z.email("Email is not valid!"),
  password: z.string().min(8, "Password have least 8 characters."),
});

type SignInFormValue = z.infer<typeof signInSchema>;

export function LoginScreen() {
  const { signIn } = useAuthStore();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormValue>({ resolver: zodResolver(signInSchema) });
  const [isHide, setIsHide] = useState(true);

  const onSubmit = async (data: SignInFormValue) => {
    const { email, password } = data;
    const { success, error } = await signIn(email, password);
    if (success) {
      navigate("/"); // or "/dashboard"
    } else {
      if (error?.errors && Array.isArray(error.errors)) {
        error.errors.forEach((err: any) => {
          if (err.field) {
            setError(err.field as any, { message: err.message });
          }
        });
      } else if (error?.message) {
        setError("root.serverError", { message: error.message });
      }
    }
  };

  return (
    <AuthLayout
      title="Welcome back."
      description="Sign in to continue your conversations and manage your digital hearth."
    >
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        {errors.root?.serverError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm text-center">
            {errors.root.serverError.message}
          </div>
        )}
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-sm font-semibold text-on-surface-variant px-1"
          >
            Email
          </label>
          <Input
            id="email"
            className="h-14 rounded-xl border-none bg-surface-container-highest text-on-surface placeholder:text-outline focus-visible:ring-2 focus-visible:ring-primary/20"
            placeholder="hello@digitalhearth.com"
            type="email"
            {...register("email")}
          />

          {/* error */}
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-on-surface-variant"
            >
              Password
            </label>
            <button
              type="button"
              className="text-xs font-bold text-primary hover:underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Input
              id="password"
              className="h-14 rounded-xl border-none bg-surface-container-highest text-on-surface placeholder:text-outline focus-visible:ring-2 focus-visible:ring-primary/20"
              placeholder="••••••••"
              type={isHide ? "password" : "text"}
              {...register("password")}
            />

            {/* error */}
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
              onClick={() => {
                setIsHide((prev) => !prev);
              }}
            >
              {isHide ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>
        <Button
          disabled={isSubmitting}
          type="submit"
          className="w-full h-14 bg-gradient-to-r from-primary to-primary-container text-white font-bold text-lg rounded-full shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          {isSubmitting ? "Signing in..." : "Sign In"}
        </Button>
      </form>

      <div className="mt-8 pt-8 border-t border-outline-variant/20 flex flex-col items-center gap-4">
        <p className="text-sm text-on-surface-variant">
          Don't have an account?
          <button
            onClick={() => {
              navigate("/signup");
            }}
            className="text-primary font-bold hover:underline ml-1"
          >
            Sign Up
          </button>
        </p>
        <div className="flex gap-4 w-full">
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-full border-outline-variant/40 flex items-center justify-center gap-2 hover:bg-surface-container-low transition-colors group"
          >
            <div className="w-5 h-5 bg-on-surface-variant group-hover:bg-primary rounded-full transition-colors" />
            <span className="text-sm font-semibold text-on-surface">
              Google
            </span>
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-12 rounded-full border-outline-variant/40 flex items-center justify-center gap-2 hover:bg-surface-container-low transition-colors group"
          >
            <Apple
              size={20}
              className="text-on-surface-variant group-hover:text-primary transition-colors"
            />
            <span className="text-sm font-semibold text-on-surface">Apple</span>
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
