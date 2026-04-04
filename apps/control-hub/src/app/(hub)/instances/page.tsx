"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { hubApi, Tenant, TenantPlan, TenantStatus } from "../../../lib/api";
import { clearSuperToken } from "../../../lib/auth";

const STATUS_OPTIONS: Array<{ value: "ALL" | TenantStatus; label: string }> = [
  { value: "ALL", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "PROVISIONING", label: "Provisioning" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DEACTIVATED", label: "Deactivated" },
];

const statusStyles: Record<TenantStatus, string> = {
  ACTIVE: "bg-success-light text-success-dark border-success-main/20",
  PROVISIONING: "bg-warning-light text-warning-dark border-warning-main/20",
  SUSPENDED: "bg-error-light text-error-dark border-error-main/20",
  DEACTIVATED: "bg-neutral-100 text-neutral-700 border-neutral-300",
};

export default function InstancesPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TenantStatus>("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadTenants();
  }, []);

  async function loadTenants() {
    setIsLoading(true);
    setError("");
    try {
      const data = await hubApi<Tenant[]>(
        statusFilter === "ALL" ? "/tenants" : `/tenants?status=${statusFilter}`,
      );
      setTenants(data);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load tenants";
      setError(message);
      if (message.toLowerCase().includes("expired") || message.toLowerCase().includes("missing")) {
        clearSuperToken();
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTenants();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((tenant) =>
      [tenant.name, tenant.slug, tenant.adminEmail, tenant.plan].some((field) =>
        field.toLowerCase().includes(q),
      ),
    );
  }, [tenants, query]);

  function planLabel(plan: TenantPlan) {
    return plan.replace("_", " ");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-neutral-900 tracking-tight">Instances</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Provision, monitor, and manage every pharmacy tenant from one control plane.
          </p>
        </div>
        <Link
          href="/instances/new"
          className="h-11 inline-flex items-center px-5 rounded-lg bg-gradient-to-r from-primary-500 to-primary-600 text-white text-sm font-semibold shadow-md shadow-primary-500/25 hover:from-primary-600 hover:to-primary-700 transition-all"
        >
          Provision Instance
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 md:p-5">
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, slug, plan, or admin email"
            className="flex-1 h-11 px-3.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | TenantStatus)}
            className="h-11 px-3.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadTenants()}
            className="h-11 px-4 border border-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-100 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50 grid grid-cols-12 text-[11px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
          <span className="col-span-3">Pharmacy</span>
          <span className="col-span-2">Subdomain</span>
          <span className="col-span-2">Status</span>
          <span className="col-span-2">Plan</span>
          <span className="col-span-2">Created</span>
          <span className="col-span-1 text-right">Action</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-sm text-neutral-500">Loading tenant instances...</div>
        ) : error ? (
          <div className="p-6">
            <p className="text-sm text-error-main bg-error-light border border-error-main/30 rounded-lg px-3 py-2">
              {error}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-sm text-neutral-500">
            No tenant instances found for the current filters.
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {filtered.map((tenant) => (
              <div key={tenant.id} className="px-5 py-4 grid grid-cols-12 items-center text-sm hover:bg-neutral-50/70 transition-colors">
                <div className="col-span-3 min-w-0">
                  <p className="font-semibold text-neutral-900 truncate">{tenant.name}</p>
                  <p className="text-xs text-neutral-500 truncate">{tenant.adminEmail}</p>
                </div>
                <div className="col-span-2 text-neutral-700 truncate">{tenant.slug}.vivipractice.com</div>
                <div className="col-span-2">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border ${statusStyles[tenant.status]}`}>
                    {tenant.status}
                  </span>
                </div>
                <div className="col-span-2 text-neutral-700">{planLabel(tenant.plan)}</div>
                <div className="col-span-2 text-neutral-600">
                  {new Date(tenant.createdAt).toLocaleDateString("en-GB")}
                </div>
                <div className="col-span-1 text-right">
                  <Link
                    href={`/instances/${tenant.id}`}
                    className="inline-flex items-center justify-center h-8 px-3 rounded-md border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 transition-colors"
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
