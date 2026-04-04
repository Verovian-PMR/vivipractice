"use client";

import { getSuperToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

type ApiOptions = RequestInit & {
  auth?: boolean;
};

export async function hubApi<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { auth = true, headers, ...rest } = options;
  const token = auth ? getSuperToken() : null;

  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...rest,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export type TenantStatus = "PROVISIONING" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
export type TenantPlan = "FREE_TRIAL" | "BASIC" | "PROFESSIONAL" | "ENTERPRISE";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  dbName: string;
  adminEmail: string;
  adminName: string;
  plan: TenantPlan;
  trialExpiresAt?: string | null;
  customDomain?: string | null;
  settings?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}
