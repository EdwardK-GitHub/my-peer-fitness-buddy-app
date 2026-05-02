import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { ApiError, api } from "../lib/api";

const adminLoginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type AdminLoginValues = z.infer<typeof adminLoginSchema>;

export function AdminLoginPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const userSession = useQuery({ queryKey: ["session", "user"], queryFn: api.getUserSession });
  const adminSession = useQuery({ queryKey: ["session", "admin"], queryFn: api.getAdminSession });

  const { register, handleSubmit, formState } = useForm<AdminLoginValues>({
    resolver: zodResolver(adminLoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const mutation = useMutation({
    mutationFn: api.loginAdmin,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session", "admin"] });
      await queryClient.invalidateQueries({ queryKey: ["session", "user"] });
      navigate("/admin/dashboard");
    },
  });

  if (adminSession.data?.authenticated) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-amber-100 bg-white p-8 shadow-xl shadow-slate-200">
        <h2 className="text-2xl font-black text-slate-950">Admin session active</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Continue to the admin dashboard to manage facilities and badge applications.
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

  if (userSession.data?.authenticated) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-emerald-100 bg-white p-8 shadow-xl shadow-slate-200">
        <h2 className="text-2xl font-black text-slate-950">Student session active</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Sign out of the student account before signing in as an admin. Student and admin sessions
          cannot be active at the same time.
        </p>
        <Link
          className="mt-6 inline-flex rounded-2xl bg-slate-950 px-5 py-3 font-bold text-white"
          to="/dashboard"
        >
          Open student dashboard
        </Link>
      </section>
    );
  }

  return (
    <section className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-200 lg:grid-cols-[0.9fr_1.1fr]">
      <aside className="bg-amber-500 p-8 text-slate-950 md:p-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/70">
          <ShieldCheck size={26} />
        </div>
        <h2 className="mt-6 text-3xl font-black">Admin sign in</h2>
        <p className="mt-4 text-sm font-semibold leading-7 text-amber-950">
          Admin accounts are reserved for campus staff oversight, facility management, and trust
          badge review. They are not used for creating or joining student workout events.
        </p>
      </aside>

      <div className="p-8 md:p-10">
        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="admin-email">
              Email
            </label>
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-amber-500"
              id="admin-email"
              type="email"
              {...register("email")}
            />
            {formState.errors.email ? (
              <p className="mt-2 text-sm text-rose-600">{formState.errors.email.message}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-slate-700" htmlFor="admin-password">
              Password
            </label>
            <input
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-amber-500"
              id="admin-password"
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
            className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-black text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:opacity-60"
            disabled={mutation.isPending}
            type="submit"
          >
            {mutation.isPending ? "Signing in..." : "Admin sign in"}
          </button>
        </form>

        <p className="mt-6 text-xs text-slate-500">
          Student user?{" "}
          <Link className="font-bold text-slate-700 underline decoration-slate-300" to="/login">
            Go to student sign in
          </Link>
        </p>
      </div>
    </section>
  );
}
