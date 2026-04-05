"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [requiresMfa, setRequiresMfa] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await api<{
        accessToken?: string;
        refreshToken?: string;
        requiresMfa?: boolean;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          ...(requiresMfa && mfaCode ? { mfaCode } : {}),
        }),
      });

      if (response.requiresMfa) {
        setRequiresMfa(true);
        return;
      }

      if (!response.accessToken) {
        throw new Error("Login failed");
      }

      localStorage.setItem("vivi_access_token", response.accessToken);
      if (response.refreshToken) {
        localStorage.setItem("vivi_refresh_token", response.refreshToken);
      }

      router.push("/services");
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Unable to sign in";
      if (message.toLowerCase().includes("tenant not found")) {
        const host = typeof window !== "undefined" ? window.location.host : "";
        setError(
          `Tenant not found for ${host}. Use the exact tenant subdomain created in Control Hub.`,
        );
        return;
      }
      setError(
        message,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary-500">VivIPractice</h1>
          <p className="text-sm text-neutral-500 mt-1">Sign in to your pharmacy dashboard</p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-10 px-3 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="admin@pharmacy.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-neutral-700 mb-1">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-10 px-3 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="••••••••"
            />
          </div>
          {requiresMfa ? (
            <div>
              <label htmlFor="mfa" className="block text-sm font-medium text-neutral-700 mb-1">MFA Code</label>
              <input
                id="mfa"
                type="text"
                required
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="w-full h-10 px-3 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="123456"
              />
            </div>
          ) : null}
          {error ? (
            <p className="text-sm text-error-main">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-10 bg-primary-500 text-white rounded-md text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            {isSubmitting ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
