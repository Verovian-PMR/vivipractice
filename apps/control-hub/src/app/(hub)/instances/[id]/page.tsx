"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { hubApi, Tenant, TenantPlan, TenantStatus } from "../../../../lib/api";

const statusOptions: TenantStatus[] = ["ACTIVE", "SUSPENDED", "DEACTIVATED"];
const planOptions: TenantPlan[] = ["FREE_TRIAL", "BASIC", "PROFESSIONAL", "ENTERPRISE"];

export default function InstanceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!id) return;
    void loadTenant(id);
  }, [id]);

  async function loadTenant(tenantId: string) {
    setIsLoading(true);
    setError("");
    try {
      const data = await hubApi<Tenant>(`/tenants/${tenantId}`);
      setTenant(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load tenant");
    } finally {
      setIsLoading(false);
    }
  }

  async function updateTenantStatus(status: TenantStatus) {
    if (!tenant) return;
    setIsWorking(true);
    setNotice("");
    setError("");
    try {
      const updated = await hubApi<Tenant>(`/tenants/${tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setTenant(updated);
      setNotice(`Status updated to ${status}.`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Unable to update status");
    } finally {
      setIsWorking(false);
    }
  }

  async function updateTenantPlan(plan: TenantPlan) {
    if (!tenant) return;
    setIsWorking(true);
    setNotice("");
    setError("");
    try {
      const updated = await hubApi<Tenant>(`/tenants/${tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ plan }),
      });
      setTenant(updated);
      setNotice(`Plan updated to ${plan.replace("_", " ")}.`);
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Unable to update plan");
    } finally {
      setIsWorking(false);
    }
  }

  async function resetAdminPassword() {
    if (!tenant) return;
    setIsWorking(true);
    setNotice("");
    setError("");
    try {
      const result = await hubApi<{ credentials: { username: string; password: string } }>(
        `/tenants/${tenant.id}/reset-admin`,
        { method: "POST" },
      );
      setNotice(
        `Password reset successful. Credentials: ${result.credentials.username} / ${result.credentials.password}`,
      );
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Unable to reset password");
    } finally {
      setIsWorking(false);
    }
  }

  async function deleteTenant() {
    if (!tenant) return;
    const confirmed = window.confirm(
      `Delete ${tenant.name} (${tenant.slug}) and drop its database? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setIsWorking(true);
    setNotice("");
    setError("");
    try {
      await hubApi(`/tenants/${tenant.id}`, { method: "DELETE" });
      router.push("/instances");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete tenant");
      setIsWorking(false);
    }
  }

  if (isLoading) {
    return <div className="text-sm text-neutral-500">Loading tenant details...</div>;
  }

  if (!tenant) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-error-main">{error || "Tenant not found."}</p>
        <Link href="/instances" className="text-sm text-primary-600 hover:text-primary-700">
          Return to instances
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">{tenant.name}</h2>
          <p className="text-sm text-neutral-500 mt-1">{tenant.slug}.vivipractice.com</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`https://${tenant.slug}.vivipractice.com`}
            target="_blank"
            rel="noreferrer"
            className="h-10 inline-flex items-center px-4 rounded-lg border border-neutral-300 text-sm font-medium hover:bg-neutral-100 transition-colors"
          >
            Open Site
          </a>
          <a
            href={`https://${tenant.slug}.vivipractice.com/dashboard`}
            target="_blank"
            rel="noreferrer"
            className="h-10 inline-flex items-center px-4 rounded-lg border border-neutral-300 text-sm font-medium hover:bg-neutral-100 transition-colors"
          >
            Open Dashboard
          </a>
          <Link
            href="/instances"
            className="h-10 inline-flex items-center px-4 rounded-lg border border-neutral-300 text-sm font-medium hover:bg-neutral-100 transition-colors"
          >
            Back
          </Link>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-semibold text-neutral-900">Tenant Information</h3>
          <div className="space-y-2 text-sm text-neutral-700">
            <p><span className="font-medium text-neutral-900">Admin:</span> {tenant.adminName}</p>
            <p><span className="font-medium text-neutral-900">Email:</span> {tenant.adminEmail}</p>
            <p><span className="font-medium text-neutral-900">Database:</span> {tenant.dbName}</p>
            <p><span className="font-medium text-neutral-900">Created:</span> {new Date(tenant.createdAt).toLocaleString("en-GB")}</p>
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 space-y-4">
          <h3 className="text-lg font-semibold text-neutral-900">Lifecycle Controls</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Status</label>
              <select
                value={tenant.status}
                onChange={(e) => void updateTenantStatus(e.target.value as TenantStatus)}
                disabled={isWorking}
                className="w-full h-11 px-3.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Plan</label>
              <select
                value={tenant.plan}
                onChange={(e) => void updateTenantPlan(e.target.value as TenantPlan)}
                disabled={isWorking}
                className="w-full h-11 px-3.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {planOptions.map((option) => (
                  <option key={option} value={option}>{option.replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void resetAdminPassword()}
              disabled={isWorking}
              className="h-10 px-4 rounded-lg border border-primary-300 bg-primary-50 text-primary-700 text-sm font-semibold hover:bg-primary-100 transition-colors disabled:opacity-70"
            >
              Reset Admin Password
            </button>
          </div>
        </div>
      </div>

      {notice ? (
        <p className="text-sm text-success-dark bg-success-light border border-success-main/30 rounded-lg px-3 py-2">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-error-main bg-error-light border border-error-main/30 rounded-lg px-3 py-2">
          {error}
        </p>
      ) : null}

      <div className="bg-white border border-error-main/30 rounded-2xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-error-dark">Danger Zone</h3>
        <p className="text-sm text-neutral-600 mt-1">
          Permanently decommission this tenant, including dropping its isolated database.
        </p>
        <button
          type="button"
          onClick={() => void deleteTenant()}
          disabled={isWorking}
          className="mt-4 h-10 px-4 rounded-lg bg-error-main text-white text-sm font-semibold hover:bg-error-dark transition-colors disabled:opacity-70"
        >
          Delete Tenant
        </button>
      </div>
    </div>
  );
}
