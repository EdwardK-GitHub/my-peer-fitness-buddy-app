import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { ApiError, api } from "../lib/api";

// Validate the form on the client before it ever reaches the API.
const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const mutation = useMutation({
    mutationFn: api.loginUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session", "user"] });
      const destination = (location.state as { from?: string } | null)?.from ?? "/dashboard";
      navigate(destination);
    },
  });

  return (
    <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-slate-900">User sign in</h2>
      <p className="mt-2 text-sm text-slate-600">Use one of the seeded accounts or create a new user account.</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="email">
            Email
          </label>
          <input
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-slate-900"
            id="email"
            type="email"
            {...register("email")}
          />
          {formState.errors.email ? (
            <p className="mt-2 text-sm text-rose-600">{formState.errors.email.message}</p>
          ) : null}
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="password">
            Password
          </label>
          <input
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-slate-900"
            id="password"
            type="password"
            {...register("password")}
          />
          {formState.errors.password ? (
            <p className="mt-2 text-sm text-rose-600">{formState.errors.password.message}</p>
          ) : null}
        </div>

        {mutation.error instanceof ApiError ? (
          <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{mutation.error.message}</p>
        ) : null}

        <button
          className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-60"
          disabled={mutation.isPending}
          type="submit"
        >
          {mutation.isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        Need an account? <Link className="font-semibold text-slate-900" to="/register">Register here</Link>.
      </p>
    </section>
  );
}