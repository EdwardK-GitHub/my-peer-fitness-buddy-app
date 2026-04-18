import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { ApiError, api } from "../lib/api";

// Keep the registration rules aligned with the backend contract.
const registerSchema = z.object({
  fullName: z.string().min(2, "Enter your full name").max(120, "Name is too long"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  const mutation = useMutation({
    mutationFn: api.registerUser,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session", "user"] });
      navigate("/dashboard");
    },
  });

  return (
    <section className="mx-auto max-w-xl rounded-3xl bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-semibold text-slate-900">Create a user account</h2>
      <p className="mt-2 text-sm text-slate-600">This registration flow is fully implemented and ready to extend.</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="fullName">
            Full name
          </label>
          <input
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-slate-900"
            id="fullName"
            type="text"
            {...register("fullName")}
          />
          {formState.errors.fullName ? (
            <p className="mt-2 text-sm text-rose-600">{formState.errors.fullName.message}</p>
          ) : null}
        </div>

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
          {mutation.isPending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        Already have an account? <Link className="font-semibold text-slate-900" to="/login">Sign in here</Link>.
      </p>
    </section>
  );
}