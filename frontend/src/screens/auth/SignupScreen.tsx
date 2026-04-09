import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, Apple } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod"; // ket noi zod voi react hook form
import { useNavigate } from "react-router";
import { useAuthStore } from "@/stores/useAuthStore";

const signUpSchema = z.object({
  fullname: z.string().min(1, "FullName must be have!"),
  email: z.email("Email is not valid!"),
  password: z.string().min(8, "Password have least 8 characters."),
});

type SignUpFormValue = z.infer<typeof signUpSchema>;

export function SignupScreen() {
  const { signUp } = useAuthStore();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormValue>({ resolver: zodResolver(signUpSchema) });

  const onSubmit = async (data: SignUpFormValue) => {
    const { fullname, email, password } = data;
    await signUp(fullname, email, password);

    navigate("/signin");
  };
  return (
    <AuthLayout
      title="Gather your people."
      description="Create an account to start hosting warm, meaningful conversations in your own digital studio."
    >
      <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-2">
          <label
            htmlFor="fullname"
            className="block text-sm font-semibold text-on-surface-variant px-1"
          >
            Full Name
          </label>
          <Input
            id="fullname"
            className="h-14 rounded-xl border-none bg-surface-container-highest text-on-surface placeholder:text-outline focus-visible:ring-2 focus-visible:ring-primary/20"
            placeholder="John Doe"
            {...register("fullname")}
          />

          {/* Error */}
          {errors.fullname && (
            <p className="text-xs text-red-500">{errors.fullname.message}</p>
          )}
        </div>

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
          {/* Error */}
          {errors.email && (
            <p className="text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <label
            htmlFor="password"
            className="block text-sm font-semibold text-on-surface-variant px-1"
          >
            Password
          </label>
          <div className="relative">
            <Input
              id="password"
              className="h-14 rounded-xl border-none bg-surface-container-highest text-on-surface placeholder:text-outline focus-visible:ring-2 focus-visible:ring-primary/20"
              placeholder="••••••••"
              type="password"
              {...register("password")}
            />
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors"
            >
              <Eye size={20} />
            </button>
          </div>
          {/* Error */}
          {errors.password && (
            <p className="text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>
        <Button className="w-full h-14 bg-gradient-to-r from-primary to-primary-container text-white font-bold text-lg rounded-full shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200">
          Sign Up
        </Button>
      </form>

      <div className="mt-8 pt-8 border-t border-outline-variant/20 flex flex-col items-center gap-4">
        <p className="text-sm text-on-surface-variant">
          Already have an account?
          <button
            onClick={() => {
              navigate("/signin");
            }}
            className="text-primary font-bold hover:underline ml-1"
          >
            Sign In
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
