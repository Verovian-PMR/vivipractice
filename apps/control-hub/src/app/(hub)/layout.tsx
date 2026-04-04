"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { clearSuperToken, isAuthenticated } from "../../lib/auth";

function NavIcon({ d }: { d: string }) {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const navItems = [
  {
    label: "Instances",
    href: "/instances",
    icon: "M3.75 6.75h16.5m-16.5 5.25h16.5m-16.5 5.25h10.5",
  },
  {
    label: "Monitoring",
    href: "/monitoring",
    icon: "M3 3v18h18M7.5 15l3-3 2.25 2.25L16.5 9",
  },
];

export default function HubLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
    }
  }, [router]);

  function isActive(href: string) {
    return pathname === href || pathname?.startsWith(href + "/");
  }

  function handleLogout() {
    clearSuperToken();
    router.replace("/login");
  }

  return (
    <div className="flex h-screen bg-neutral-50">
      <aside className="w-[280px] bg-neutral-950 text-white flex flex-col border-r border-neutral-800/80">
        <div className="px-6 py-6 border-b border-neutral-800/80">
          <p className="text-[11px] uppercase tracking-[0.2em] text-primary-300/90 font-semibold">
            VivIPractice
          </p>
          <h1 className="text-2xl font-bold mt-2 leading-tight">Control Hub</h1>
          <p className="text-xs text-neutral-400 mt-1">Enterprise Tenant Operations</p>
        </div>

        <nav className="flex-1 px-4 py-5 space-y-1.5">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active
                    ? "bg-primary-500/20 text-white border border-primary-400/30"
                    : "text-neutral-300 hover:bg-neutral-900 hover:text-white"
                }`}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-400 rounded-r-full" />
                ) : null}
                <NavIcon d={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-800/80">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full h-10 rounded-lg border border-neutral-700 text-neutral-200 text-sm font-medium hover:bg-neutral-900 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
