"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { hubApi } from "../../../lib/api";
import { isAuthenticated, setSuperToken } from "../../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/instances");
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const data = await hubApi<{ accessToken: string; admin: { name: string } }>(
        "/super/login",
        {
          method: "POST",
          auth: false,
          body: JSON.stringify({ email, password }),
        },
      );
      setSuperToken(data.accessToken);
      router.push("/instances");
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Unable to sign in",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(15,82,186,0.35),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(30,136,229,0.2),transparent_35%),radial-gradient(circle_at_60%_80%,rgba(230,81,0,0.15),transparent_30%)]" />
      <div className="relative w-full max-w-md rounded-2xl border border-neutral-700/70 bg-neutral-900/80 backdrop-blur-xl shadow-[0_24px_80px_rgba(0,0,0,0.5)] p-8">
        <div className="mb-8">
          <p className="inline-flex items-center rounded-full bg-primary-500/15 text-primary-200 text-xs font-semibold px-3 py-1 border border-primary-400/30">
            VivIPractice Control Hub
          </p>
          <h1 className="text-3xl font-bold mt-4 tracking-tight text-white">
            Super Admin Sign In
          </h1>
          <p className="text-sm text-neutral-400 mt-2">
            Access tenant provisioning, lifecycle operations, and fleet analytics.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-200 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-11 px-3.5 border border-neutral-700 bg-neutral-950/70 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              placeholder="admin@vivipractice.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-200 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-3.5 border border-neutral-700 bg-neutral-950/70 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              placeholder="••••••••"
            />
          </div>

          {error ? (
            <p className="text-sm text-error-main bg-error-light/10 border border-error-main/30 rounded-lg px-3 py-2">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-11 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white text-sm font-semibold hover:from-primary-600 hover:to-primary-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary-900/30"
          >
            {isSubmitting ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
