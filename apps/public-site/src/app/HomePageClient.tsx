"use client";

import { useEffect, useState } from "react";

import ComponentRenderer from "@/components/renderers/ComponentRenderer";
import { fetchPage, fetchServicesData } from "@/lib/api";
import { DEFAULT_PAGES } from "@/lib/site-config";

type HomePageState = {
  components: Array<{
    id: string;
    defId: string;
    config: Record<string, unknown>;
    order: number;
  }>;
};

export default function HomePageClient() {
  const [homePage, setHomePage] = useState<HomePageState | null>(
    () => (DEFAULT_PAGES.find((p) => p.slug === "/") as HomePageState) ?? null,
  );
  const [services, setServices] = useState<any[] | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [remotePage, remoteServices] = await Promise.all([
          fetchPage("/"),
          fetchServicesData(),
        ]);

        if (remotePage && Array.isArray(remotePage.components) && remotePage.components.length > 0) {
          setHomePage({
            ...remotePage,
            components: remotePage.components.map((c: any) => ({
              id: c.id,
              defId: c.defId,
              config: typeof c.config === "string" ? JSON.parse(c.config) : c.config,
              order: c.order,
            })),
          });
        }
        setServices(remoteServices);
      } catch {
        setServices(null);
      }
    }

    void load();
  }, []);

  if (!homePage) return null;

  return (
    <div>
      <ComponentRenderer components={homePage.components} services={services} />
    </div>
  );
}
