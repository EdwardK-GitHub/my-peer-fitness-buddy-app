import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { ApiError, api } from "../lib/api";

const registerSchema = z.object({
  fullName: z.string().min(2, "Enter your full name").max(120, "Name is too long"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type RegisterValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const userSession = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });
  const adminSession = useQuery({ queryKey: ["session", "admin"], queryFn: api.getAdminSession });

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

  if (userSession.data?.authenticated) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-emerald-100 bg-white p-8 shadow-xl shadow-slate-200">
        <h2 className="text-2xl font-black text-slate-950">You already have an active session</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Continue to your dashboard to manage your campus fitness events.
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
        <h2 className="text-2xl font-black text-slate-950">Admin session active</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign out of the admin account before creating a student account.
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
      <aside className="bg-blue-600 p-8 text-white md:p-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
          <UserPlus size={26} />
        </div>
        <h2 className="mt-6 text-3xl font-black">Create a student account</h2>
        <p className="mt-4 text-sm leading-7 text-blue-50">
          Join the campus fitness hub to create events, find workout partners, track your schedule,
          and apply for trust badges.
        </p>
      </aside>

      <div className="p-8 md:p-10">
        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="fullName">
              Full name
            </label>
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-blue-600"
              id="fullName"
              type="text"
              {...register("fullName")}
            />
            {formState.errors.fullName ? (
              <p className="mt-2 text-sm text-rose-600">{formState.errors.fullName.message}</p>
            ) : null}
          </div>

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
            {mutation.isPending ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-600">
          Already have an account?{" "}
          <Link className="font-black text-slate-950" to="/login">
            Sign in
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
