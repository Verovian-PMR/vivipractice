"use client";

const SUPER_TOKEN_KEY = "vivi_super_token";

export function getSuperToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SUPER_TOKEN_KEY);
}

export function setSuperToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SUPER_TOKEN_KEY, token);
}

export function clearSuperToken() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SUPER_TOKEN_KEY);
}

export function isAuthenticated() {
  return Boolean(getSuperToken());
}
