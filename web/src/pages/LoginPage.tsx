import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { ApiError, api } from "../lib/api";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const userSession = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });
  const adminSession = useQuery({ queryKey: ["session", "admin"], queryFn: api.getAdminSession });

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
      await queryClient.invalidateQueries({ queryKey: ["session", "admin"] });
      const destination = (location.state as { from?: string } | null)?.from ?? "/dashboard";
      navigate(destination);
    },
  });

  if (userSession.data?.authenticated) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-emerald-100 bg-white p-8 shadow-xl shadow-slate-200">
        <h2 className="text-2xl font-black text-slate-950">You are already signed in</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Continue to your student dashboard to manage events and badge applications.
        </p>
        <Link
          className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white"
          to="/dashboard"
        >
          Open dashboard
        </Link>
      </section>
    );
  }

  if (adminSession.data?.authenticated) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-amber-100 bg-white p-8 shadow-xl shadow-slate-200">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <ShieldCheck size={24} />
        </div>
        <h2 className="text-2xl font-black text-slate-950">Admin session active</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign out of the admin account before signing in as a student. Student and admin sessions
          cannot be active at the same time.
        </p>
        <Link
          className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white"
          to="/admin/dashboard"
        >
          Open admin dashboard
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-200 lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="bg-slate-950 p-8 text-white md:p-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
          <LockKeyhole size={26} />
        </div>
        <h2 className="mt-6 text-3xl font-black">Student sign in</h2>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Sign in to post workout events, join classmates, manage your schedule, like past attended
          events, and submit trust badge applications.
        </p>

        <div className="mt-8 rounded-3xl border border-white/10 bg-white/10 p-5">
          <p className="text-sm font-bold text-white">Role reminder</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Student accounts are for event participation. Admin accounts are only for oversight and
            review tasks.
          </p>
        </div>
      </aside>

      <div className="p-8 md:p-10">
        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-blue-600"
              id="email"
              type="email"
              {...register("email")}
            />
            {formState.errors.email ? (
              <p className="mt-2 text-sm text-rose-600">{formState.errors.email.message}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-blue-600"
              id="password"
              type="password"
              {...register("password")}
            />
            {formState.errors.password ? (
              <p className="mt-2 text-sm text-rose-600">{formState.errors.password.message}</p>
            ) : null}
          </div>

          {mutation.error instanceof ApiError ? (
            <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
              {mutation.error.message}
            </p>
          ) : null}

          <button
            className="w-full rounded-2xl bg-blue-600 px-4 py-3 font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-60"
            disabled={mutation.isPending}
            type="submit"
          >
            {mutation.isPending ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-6 space-y-3 text-sm text-slate-600">
          <p>
            Need an account?{" "}
            <Link className="font-black text-slate-950" to="/register">
              Create a student account
            </Link>
            .
          </p>
          <p className="text-xs text-slate-500">
            Campus staff?{" "}
            <Link className="font-bold text-slate-700 underline decoration-slate-300" to="/admin/login">
              Admin sign in
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
