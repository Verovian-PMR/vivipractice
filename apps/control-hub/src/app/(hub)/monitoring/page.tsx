"use client";

import { useEffect, useState } from "react";

import { hubApi, Tenant } from "../../../lib/api";

type Stats = {
  total: number;
  active: number;
  suspended: number;
  provisioning: number;
};

export default function MonitoringPage() {
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, suspended: 0, provisioning: 0 });
  const [recent, setRecent] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setIsLoading(true);
    setError("");
    try {
      const [statsResult, tenantsResult] = await Promise.all([
        hubApi<Stats>("/tenants/stats"),
        hubApi<Tenant[]>("/tenants"),
      ]);
      setStats(statsResult);
      setRecent(tenantsResult.slice(0, 8));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load monitoring data");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900">Monitoring</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Fleet-level visibility across tenant activation and provisioning lifecycle.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="h-10 px-4 rounded-lg border border-neutral-300 text-sm font-medium hover:bg-neutral-100 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        {[
          { label: "Total Instances", value: stats.total, color: "text-primary-600" },
          { label: "Active", value: stats.active, color: "text-success-main" },
          { label: "Suspended", value: stats.suspended, color: "text-error-main" },
          { label: "Provisioning", value: stats.provisioning, color: "text-warning-main" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
            <p className="text-xs font-semibold tracking-[0.08em] uppercase text-neutral-500">{stat.label}</p>
            <p className={`text-4xl font-bold mt-2 ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 bg-neutral-50">
          <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-[0.08em]">
            Recent Provisioning Activity
          </h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-sm text-neutral-500">Loading activity feed...</div>
        ) : error ? (
          <div className="p-6">
            <p className="text-sm text-error-main bg-error-light border border-error-main/30 rounded-lg px-3 py-2">
              {error}
            </p>
          </div>
        ) : recent.length === 0 ? (
          <div className="p-8 text-sm text-neutral-500">No tenant activity yet.</div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {recent.map((tenant) => (
              <div key={tenant.id} className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{tenant.name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{tenant.slug}.vivipractice.com</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-neutral-600">{tenant.status}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {new Date(tenant.createdAt).toLocaleString("en-GB")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
