"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { hubApi, TenantPlan } from "../../../../lib/api";

const planOptions: TenantPlan[] = ["FREE_TRIAL", "BASIC", "PROFESSIONAL", "ENTERPRISE"];

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function NewInstancePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [plan, setPlan] = useState<TenantPlan>("FREE_TRIAL");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generatedPassword = useMemo(() => `${slug || "tenant"}1234`, [slug]);

  function handleNameChange(value: string) {
    setName(value);
    if (!slug) {
      setSlug(slugify(value));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const payload = {
        name,
        slug: slugify(slug),
        adminName,
        adminEmail,
        plan,
      };

      const result = await hubApi<{ id: string; slug: string; credentials?: { username: string; password: string } }>(
        "/tenants",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      setSuccess(
        `Instance provisioned successfully. Credentials: ${result.credentials?.username ?? adminEmail} / ${result.credentials?.password ?? generatedPassword}`,
      );
      setTimeout(() => router.push(`/instances/${result.id}`), 1200);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Provisioning failed",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Provision Instance</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Create a new pharmacy tenant with isolated database and admin credentials.
          </p>
        </div>
        <Link
          href="/instances"
          className="h-10 inline-flex items-center px-4 rounded-lg border border-neutral-300 text-sm font-medium hover:bg-neutral-100 transition-colors"
        >
          Back to Instances
        </Link>
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 md:p-7">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Pharmacy Name</label>
              <input
                required
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full h-11 px-3.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Tar Pharmacy"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Subdomain Slug</label>
              <input
                required
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                className="w-full h-11 px-3.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="tarpharmacy"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Admin Name</label>
              <input
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full h-11 px-3.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Admin Email</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full h-11 px-3.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="admin@tarpharmacy.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1.5">Plan</label>
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value as TenantPlan)}
              className="w-full h-11 px-3.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              {planOptions.map((option) => (
                <option key={option} value={option}>
                  {option.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
            <p className="text-sm text-primary-800 font-semibold">Generated credentials preview</p>
            <p className="text-sm text-primary-700 mt-1">
              Username: {adminEmail || "admin@example.com"} | Password: {generatedPassword}
            </p>
          </div>

          {error ? (
            <p className="text-sm text-error-main bg-error-light border border-error-main/30 rounded-lg px-3 py-2">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="text-sm text-success-dark bg-success-light border border-success-main/30 rounded-lg px-3 py-2">
              {success}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 px-5 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white text-sm font-semibold hover:from-primary-600 hover:to-primary-700 disabled:opacity-70 disabled:cursor-not-allowed transition-all shadow-md shadow-primary-500/25"
          >
            {isSubmitting ? "Provisioning..." : "Provision Instance"}
          </button>
        </form>
      </div>
    </div>
  );
}
