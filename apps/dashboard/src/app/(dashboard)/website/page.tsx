"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { SitePage, ComponentDef, GlobalSettings, ConfigField } from "./types";
import { CATEGORY_COLORS, CATEGORY_LABELS, FONT_OPTIONS } from "./types";
import { DEFAULT_SETTINGS, DEFAULT_PAGES, COMPONENT_LIBRARY } from "./data";
import { DEMO_SERVICES } from "../services/data";
import type { ServiceMetadata } from "../services/types";
import { api } from "@/lib/api";
import sanitizeHtml from "sanitize-html";

type WebsiteTab = "global" | "pages" | "library";

/* ── Reusable helpers ──────────────────────────────────────────── */
function SectionLabel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-6 py-4 border-b border-neutral-200">
      <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
      <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
    </div>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="text-sm text-neutral-700 text-right">{value || "—"}</span>
    </div>
  );
}

function SaveToast({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg animate-[fadeIn_0.2s_ease-out]">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-sm font-medium">Changes saved successfully</span>
    </div>
  );
}

function SaveButton({ onClick, saving }: { onClick: () => void; saving?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors shadow-sm disabled:opacity-60"
    >
      {saving ? (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 3.75H6.912a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H15M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0l-3-3m3 3l3-3" />
        </svg>
      )}
      {saving ? "Saving…" : "Save Changes"}
    </button>
  );
}

/** Strip dangerous tags/attributes from HTML to prevent XSS (React2Shell, stored XSS). */
const SANITIZE_OPTIONS = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "ul",
    "ol",
    "li",
    "a",
    "h1",
    "h2",
    "h3",
    "h4",
    "blockquote",
    "code",
    "pre",
    "span",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    span: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  enforceHtmlBoundary: true,
};

export default function WebsitePage() {
  const [activeTab, setActiveTab] = useState<WebsiteTab>("global");
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_SETTINGS);
  const [pages, setPages] = useState<SitePage[]>(DEFAULT_PAGES);
  const [selectedPageId, setSelectedPageId] = useState<string>(DEFAULT_PAGES[0].id);
  const [componentDefs, setComponentDefs] = useState<ComponentDef[]>(COMPONENT_LIBRARY);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(DEMO_SERVICES[0]?.id ?? "");
  const [selectedComponentId, setSelectedComponentId] = useState<string>(COMPONENT_LIBRARY[0]?.id ?? "");
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Live services list (localStorage + defaults) so the service selector
  // includes dashboard-created services, not just the 8 hardcoded demos.
  const [allServices, setAllServices] = useState<ServiceMetadata[]>(DEMO_SERVICES);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("vivipractice_services");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAllServices(parsed);
          return;
        }
      }
    } catch {}
  }, []);

  /* ── Fetch data from API on mount ── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [siteSettings, apiPages] = await Promise.all([
          api<GlobalSettings | null>("/site-settings").catch(() => null),
          api<any[] | null>("/pages").catch(() => null),
        ]);
        if (cancelled) return;
        if (siteSettings) setSettings(siteSettings);
        if (apiPages && apiPages.length > 0) {
          // Map API shape → SitePage shape, force-merge isServices/isBooking
          // by slug so preset templates always work even if DB flags are wrong
          const mapped: SitePage[] = apiPages.map((p: any) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
            isVisible: p.isVisible,
            isDefault: p.isDefault ?? false,
            isServices: p.slug === "/services" ? true : (p.isServices ?? false),
            isBooking: p.slug === "/booking" ? true : (p.isBooking ?? false),
            order: p.order,
            components: (p.components ?? []).map((c: any) => ({
              id: c.id,
              defId: c.defId,
              config: typeof c.config === "string" ? JSON.parse(c.config) : c.config,
              order: c.order,
            })),
          }));
          setPages(mapped);
          if (mapped.length > 0) setSelectedPageId(mapped[0].id);
        }
      } catch {
        // API unavailable — keep defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const selectedPage = pages.find((p) => p.id === selectedPageId) ?? pages[0];
  const selectedService = DEMO_SERVICES.find((s) => s.id === selectedServiceId) ?? DEMO_SERVICES[0];
  const selectedComponent = componentDefs.find((c) => c.id === selectedComponentId) ?? componentDefs[0];

  const effectiveFooterBg = settings.footer.useCustomBg ? settings.footer.bgColor : settings.brand.primaryColor;
  const sortedPages = useMemo(() => [...pages].sort((a, b) => a.order - b.order), [pages]);

  /* ── Save handler → API ── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await Promise.all([
        api("/site-settings", {
          method: "PATCH",
          body: JSON.stringify(settings),
        }),
        api("/pages/bulk", {
          method: "PUT",
          body: JSON.stringify({ pages }),
        }),
      ]);

      // Invalidate public-site cache so changes appear immediately
      const publicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3003";
      fetch(`${publicSiteUrl}/api/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: ["settings", "pages"] }),
      }).catch(() => {}); // fire-and-forget — don't block save

      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 2500);
    } catch (err: any) {
      setSaveError(err.message || "Save failed");
      setTimeout(() => setSaveError(null), 4000);
    } finally {
      setSaving(false);
    }
  }, [settings, pages]);

  /* ── Page actions ── */
  const togglePageVisibility = useCallback((pageId: string) => {
    setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, isVisible: !p.isVisible } : p)));
  }, []);

  const movePage = useCallback((pageId: string, direction: -1 | 1) => {
    setPages((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((p) => p.id === pageId);
      const nextIdx = idx + direction;
      if (idx < 0 || nextIdx < 0 || nextIdx >= sorted.length) return prev;
      const temp = sorted[idx];
      sorted[idx] = sorted[nextIdx];
      sorted[nextIdx] = temp;
      return sorted.map((p, i) => ({ ...p, order: i }));
    });
  }, []);

  const addComponentToPage = useCallback((pageId: string, def: ComponentDef) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              components: [
                ...p.components,
                {
                  id: `cmp-${Date.now()}-${Math.floor(Math.random() * 999)}`,
                  defId: def.id,
                  config: { ...def.defaultConfig },
                  order: p.components.length,
                },
              ],
            }
          : p
      )
    );
  }, []);

  const removeComponentFromPage = useCallback((pageId: string, componentId: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              components: p.components
                .filter((c) => c.id !== componentId)
                .map((c, idx) => ({ ...c, order: idx })),
            }
          : p
      )
    );
    if (editingComponentId === componentId) setEditingComponentId(null);
  }, [editingComponentId]);

  const updateInstanceConfig = useCallback((pageId: string, componentId: string, key: string, value: unknown) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              components: p.components.map((c) =>
                c.id === componentId ? { ...c, config: { ...c.config, [key]: value } } : c
              ),
            }
          : p
      )
    );
  }, []);

  const toggleServiceInConfig = useCallback((pageId: string, componentId: string, serviceId: string) => {
    setPages((prev) =>
      prev.map((p) =>
        p.id === pageId
          ? {
              ...p,
              components: p.components.map((c) => {
                if (c.id !== componentId) return c;
                const ids = (c.config.selectedServiceIds as string[]) ?? [];
                const next = ids.includes(serviceId) ? ids.filter((x) => x !== serviceId) : [...ids, serviceId];
                return { ...c, config: { ...c.config, selectedServiceIds: next } };
              }),
            }
          : p
      )
    );
  }, []);

  const updateComponentDefConfig = useCallback((componentId: string, key: string, value: unknown) => {
    setComponentDefs((prev) =>
      prev.map((c) =>
        c.id === componentId
          ? { ...c, defaultConfig: { ...c.defaultConfig, [key]: value } }
          : c
      )
    );
  }, []);

  const toggleServiceInDefConfig = useCallback((componentId: string, serviceId: string) => {
    setComponentDefs((prev) =>
      prev.map((c) => {
        if (c.id !== componentId) return c;
        const ids = (c.defaultConfig.selectedServiceIds as string[]) ?? [];
        const next = ids.includes(serviceId) ? ids.filter((x) => x !== serviceId) : [...ids, serviceId];
        return { ...c, defaultConfig: { ...c.defaultConfig, selectedServiceIds: next } };
      })
    );
  }, []);

  function getDef(defId: string) {
    return componentDefs.find((d) => d.id === defId);
  }

  const inputCls =
    "w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors";

  /* ── Config Field Renderer (for page instance editing) ── */
  function renderConfigField(field: ConfigField, config: Record<string, unknown>, onUpdate: (key: string, val: unknown) => void, onToggleService?: (svcId: string) => void) {
    // Conditional visibility
    if (field.showWhen) {
      const actual = String(config[field.showWhen.field] ?? "");
      if (actual !== field.showWhen.value) return null;
    }

    const val = config[field.key];

    switch (field.type) {
      case "text":
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-neutral-600 mb-1">{field.label}</label>
            <input type="text" value={String(val ?? "")} onChange={(e) => onUpdate(field.key, e.target.value)} placeholder={field.placeholder} className={inputCls} />
          </div>
        );

      case "textarea":
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-neutral-600 mb-1">{field.label}</label>
            <textarea value={String(val ?? "")} onChange={(e) => onUpdate(field.key, e.target.value)} placeholder={field.placeholder} rows={4} className={`${inputCls} resize-y`} />
          </div>
        );

      case "number":
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-neutral-600 mb-1">{field.label}</label>
            <input type="number" value={String(val ?? "")} onChange={(e) => onUpdate(field.key, e.target.value)} className={inputCls} />
          </div>
        );

      case "color":
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-neutral-600 mb-1">{field.label}</label>
            <div className="flex items-center gap-2">
              <input type="color" value={String(val ?? "#000000").replace(/rgba?\([^)]+\)/, "#000000")} onChange={(e) => onUpdate(field.key, e.target.value)} className="w-10 h-10 rounded-lg border border-neutral-300 bg-white p-1" />
              <input type="text" value={String(val ?? "")} onChange={(e) => onUpdate(field.key, e.target.value)} className={inputCls} />
            </div>
          </div>
        );

      case "select":
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-neutral-600 mb-1">{field.label}</label>
            <select value={String(val ?? "")} onChange={(e) => onUpdate(field.key, e.target.value)} className={inputCls}>
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        );

      case "toggle":
        return (
          <div key={field.key} className="flex items-center justify-between py-1">
            <label className="text-xs font-medium text-neutral-600">{field.label}</label>
            <button
              type="button"
              onClick={() => onUpdate(field.key, !val)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${val ? "bg-primary-500" : "bg-neutral-300"}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${val ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        );

      case "multiselect-services":
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-neutral-600 mb-1">{field.label}</label>
            <div className="border border-neutral-300 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
              {allServices.map((svc) => {
                const ids = (val as string[]) ?? [];
                const checked = ids.includes(svc.id);
                return (
                  <label key={svc.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-neutral-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleService?.(svc.id)}
                      className="w-4 h-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500/20"
                    />
                    <span className="text-sm text-neutral-700">{svc.name}</span>
                    {svc.isFeatured && <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Featured</span>}
                  </label>
                );
              })}
            </div>
            {((val as string[]) ?? []).length > 0 && (
              <p className="text-[11px] text-neutral-500 mt-1">{((val as string[]) ?? []).length} selected</p>
            )}
          </div>
        );

      case "image": {
        const handleImageFile = (file: File) => {
          const reader = new FileReader();
          reader.onload = () => onUpdate(field.key, reader.result as string);
          reader.readAsDataURL(file);
        };
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-neutral-600 mb-1">{field.label}</label>
            {val ? (
              <div className="border border-neutral-200 rounded-lg overflow-hidden bg-neutral-50">
                <div className="w-full h-32 bg-neutral-100 flex items-center justify-center overflow-hidden">
                  <img src={String(val)} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
                <div className="flex items-center justify-end gap-2 p-2">
                  <button type="button" onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = () => { if (inp.files?.[0]) handleImageFile(inp.files[0]); }; inp.click(); }} className="px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-md transition-colors">Change</button>
                  <button type="button" onClick={() => onUpdate(field.key, "")} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors">Remove</button>
                </div>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors cursor-pointer"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary-400", "bg-primary-50"); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary-400", "bg-primary-50"); }}
                onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-primary-400", "bg-primary-50"); if (e.dataTransfer.files?.[0]) handleImageFile(e.dataTransfer.files[0]); }}
                onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = () => { if (inp.files?.[0]) handleImageFile(inp.files[0]); }; inp.click(); }}
              >
                <svg className="w-8 h-8 mx-auto text-neutral-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                </svg>
                <p className="text-xs font-medium text-neutral-600">Click or drag & drop an image</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">PNG, JPG, WebP — or paste URL below</p>
              </div>
            )}
            <input type="text" value={String(val ?? "")} onChange={(e) => onUpdate(field.key, e.target.value)} placeholder="Or paste image URL" className={`${inputCls} mt-2`} />
          </div>
        );
      }

      case "images": {
        const imgs = (val as string[]) ?? [];
        const handleFiles = (files: FileList | null) => {
          if (!files) return;
          Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = () => {
              onUpdate(field.key, [...((val as string[]) ?? []), reader.result as string]);
            };
            reader.readAsDataURL(file);
          });
        };
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-neutral-600 mb-1">{field.label}</label>
            {/* Thumbnail grid */}
            {imgs.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-3">
                {imgs.map((url, i) => (
                  <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
                    <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    <button
                      type="button"
                      onClick={() => onUpdate(field.key, imgs.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Dropzone */}
            <div
              className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors cursor-pointer"
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary-400", "bg-primary-50"); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove("border-primary-400", "bg-primary-50"); }}
              onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-primary-400", "bg-primary-50"); handleFiles(e.dataTransfer.files); }}
              onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true; inp.onchange = () => handleFiles(inp.files); inp.click(); }}
            >
              <svg className="w-8 h-8 mx-auto text-neutral-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
              <p className="text-xs font-medium text-neutral-600">Click or drag & drop images</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">PNG, JPG, WebP — multiple files allowed</p>
            </div>
            {imgs.length > 0 && <p className="text-[11px] text-neutral-500 mt-1.5">{imgs.length} image{imgs.length !== 1 ? "s" : ""}</p>}
          </div>
        );
      }

      case "address":
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-neutral-600 mb-1">{field.label}</label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <input
                type="text"
                value={String(val ?? "")}
                onChange={(e) => onUpdate(field.key, e.target.value)}
                placeholder={field.placeholder}
                className={`${inputCls} pl-9`}
              />
            </div>
            {String(val ?? "") && (
              <div className="mt-2 rounded-lg border border-neutral-200 overflow-hidden bg-neutral-100 h-32 flex items-center justify-center">
                <iframe
                  title="Map Preview"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=-0.15%2C51.49%2C-0.10%2C51.52&layer=mapnik`}
                />
              </div>
            )}
          </div>
        );

      case "faq-items": {
        const items = (val as { q: string; a: string }[]) ?? [];
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-neutral-600 mb-1">{field.label}</label>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="border border-neutral-200 rounded-lg p-3 space-y-2 bg-neutral-50">
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-bold text-neutral-400 mt-2 shrink-0">Q{i + 1}</span>
                    <input
                      type="text"
                      value={item.q}
                      onChange={(e) => {
                        const updated = [...items];
                        updated[i] = { ...updated[i], q: e.target.value };
                        onUpdate(field.key, updated);
                      }}
                      placeholder="Question"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() => onUpdate(field.key, items.filter((_, j) => j !== i))}
                      className="p-1.5 rounded text-neutral-400 hover:text-red-500 shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <textarea
                    value={item.a}
                    onChange={(e) => {
                      const updated = [...items];
                      updated[i] = { ...updated[i], a: e.target.value };
                      onUpdate(field.key, updated);
                    }}
                    placeholder="Answer"
                    rows={2}
                    className={`${inputCls} resize-none`}
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onUpdate(field.key, [...items, { q: "", a: "" }])}
              className="mt-2 text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              + Add FAQ Item
            </button>
          </div>
        );
      }

      case "table-rows": {
        const rows = (val as string[][]) ?? [];
        return (
          <div key={field.key}>
            <label className="block text-xs font-medium text-neutral-600 mb-1">{field.label}</label>
            <div className="space-y-2">
              {rows.map((row, ri) => (
                <div key={ri} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-neutral-400 shrink-0 w-4">{ri + 1}</span>
                  {row.map((cell, ci) => (
                    <input
                      key={ci}
                      type="text"
                      value={cell}
                      onChange={(e) => {
                        const updated = rows.map((r) => [...r]);
                        updated[ri][ci] = e.target.value;
                        onUpdate(field.key, updated);
                      }}
                      className={`${inputCls} flex-1`}
                      placeholder={`Column ${ci + 1}`}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => onUpdate(field.key, rows.filter((_, j) => j !== ri))}
                    className="p-1.5 rounded text-neutral-400 hover:text-red-500 shrink-0"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                const colCount = rows.length > 0 ? rows[0].length : 3;
                onUpdate(field.key, [...rows, Array(colCount).fill("")]);
              }}
              className="mt-2 text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              + Add Row
            </button>
          </div>
        );
      }

      default:
        return null;
    }
  }

  /* ── Tab button renderer ── */
  function renderTabButton(id: WebsiteTab, label: string, subtitle: string, iconPath: string) {
    const active = activeTab === id;
    return (
      <button
        type="button"
        onClick={() => setActiveTab(id)}
        className={`group relative flex-1 text-left px-4 py-3 rounded-xl border transition-all ${
          active
            ? "bg-primary-50 border-primary-300 shadow-sm"
            : "bg-white border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300"
        }`}
      >
        {active && <span className="absolute left-0 top-2 bottom-2 w-1 bg-primary-500 rounded-r-full" />}
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${active ? "bg-primary-100 text-primary-700" : "bg-neutral-100 text-neutral-500 group-hover:text-neutral-700"}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
            </svg>
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${active ? "text-primary-800" : "text-neutral-800"}`}>{label}</p>
            <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div>
      <SaveToast show={showSaveToast} />
      {saveError && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-red-600 text-white px-5 py-3 rounded-xl shadow-lg">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg>
          <span className="text-sm font-medium">{saveError}</span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-neutral-900">Website Customization</h2>
        <p className="text-sm text-neutral-500 mt-0.5">Configure global branding, page visibility, and reusable components.</p>
      </div>

      {/* ── Horizontal Tabs ── */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {renderTabButton("global", "Global Settings", "Brand, header, and footer configuration", "M11.49 3.17c.325-1.068 1.696-1.068 2.022 0a1.125 1.125 0 001.522.68l.273-.137c.96-.48 2.07.326 1.79 1.376a1.125 1.125 0 00.756 1.386l.31.103c1.08.36 1.08 1.888 0 2.247l-.31.103a1.125 1.125 0 00-.756 1.386c.28 1.05-.83 1.856-1.79 1.376l-.273-.137a1.125 1.125 0 00-1.522.68c-.325 1.068-1.696 1.068-2.022 0a1.125 1.125 0 00-1.522-.68l-.273.137c-.96.48-2.07-.326-1.79-1.376a1.125 1.125 0 00-.756-1.386l-.31-.103c-1.08-.36-1.08-1.888 0-2.247l.31-.103a1.125 1.125 0 00.756-1.386c-.28-1.05.83-1.856 1.79-1.376l.273.137a1.125 1.125 0 001.522-.68zM12 8.25a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z")}
        {renderTabButton("pages", "Page Manager", "Show/hide pages and manage page composition", "M3.75 4.5h16.5M3.75 9.75h16.5M3.75 15h16.5M3.75 20.25h16.5")}
        {renderTabButton("library", "Component Library", "Single source of truth for reusable components", "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z")}
      </div>

      {/* ════════════════ GLOBAL SETTINGS TAB ════════════════ */}
      {activeTab === "global" && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
            <SectionLabel title="Branding" subtitle="Logo, favicon, and typography settings." />
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                {/* Logo */}
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Logo</label>
                  {settings.brand.logoUrl ? (
                    <div className="border border-neutral-200 rounded-lg overflow-hidden bg-neutral-50">
                      <div className="w-full h-24 bg-white flex items-center justify-center p-3">
                        <img src={settings.brand.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </div>
                      <div className="flex items-center justify-end gap-2 p-2 border-t border-neutral-100">
                        <button type="button" onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = () => { if (inp.files?.[0]) { const r = new FileReader(); r.onload = () => setSettings((s) => ({ ...s, brand: { ...s.brand, logoUrl: r.result as string } })); r.readAsDataURL(inp.files[0]); } }; inp.click(); }} className="px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-md transition-colors">Change</button>
                        <button type="button" onClick={() => setSettings((s) => ({ ...s, brand: { ...s.brand, logoUrl: "" } }))} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors">Remove</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors cursor-pointer"
                      onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = () => { if (inp.files?.[0]) { const r = new FileReader(); r.onload = () => setSettings((s) => ({ ...s, brand: { ...s.brand, logoUrl: r.result as string } })); r.readAsDataURL(inp.files[0]); } }; inp.click(); }}
                    >
                      <svg className="w-8 h-8 mx-auto text-neutral-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
                      <p className="text-xs font-medium text-neutral-600">Click to upload logo</p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">SVG, PNG, JPG</p>
                    </div>
                  )}
                  <input type="text" value={settings.brand.logoUrl} onChange={(e) => setSettings((s) => ({ ...s, brand: { ...s.brand, logoUrl: e.target.value } }))} placeholder="Or paste URL" className={`${inputCls} mt-2`} />
                </div>
                {/* Favicon */}
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Favicon</label>
                  {settings.brand.faviconUrl ? (
                    <div className="border border-neutral-200 rounded-lg overflow-hidden bg-neutral-50">
                      <div className="w-full h-24 bg-white flex items-center justify-center p-3">
                        <img src={settings.brand.faviconUrl} alt="Favicon" className="max-h-full max-w-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </div>
                      <div className="flex items-center justify-end gap-2 p-2 border-t border-neutral-100">
                        <button type="button" onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*,.ico"; inp.onchange = () => { if (inp.files?.[0]) { const r = new FileReader(); r.onload = () => setSettings((s) => ({ ...s, brand: { ...s.brand, faviconUrl: r.result as string } })); r.readAsDataURL(inp.files[0]); } }; inp.click(); }} className="px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-md transition-colors">Change</button>
                        <button type="button" onClick={() => setSettings((s) => ({ ...s, brand: { ...s.brand, faviconUrl: "" } }))} className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors">Remove</button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors cursor-pointer"
                      onClick={() => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*,.ico"; inp.onchange = () => { if (inp.files?.[0]) { const r = new FileReader(); r.onload = () => setSettings((s) => ({ ...s, brand: { ...s.brand, faviconUrl: r.result as string } })); r.readAsDataURL(inp.files[0]); } }; inp.click(); }}
                    >
                      <svg className="w-8 h-8 mx-auto text-neutral-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
                      <p className="text-xs font-medium text-neutral-600">Click to upload favicon</p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">ICO, PNG, SVG</p>
                    </div>
                  )}
                  <input type="text" value={settings.brand.faviconUrl} onChange={(e) => setSettings((s) => ({ ...s, brand: { ...s.brand, faviconUrl: e.target.value } }))} placeholder="Or paste URL" className={`${inputCls} mt-2`} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Font Family</label>
                <select value={settings.brand.fontFamily} onChange={(e) => setSettings((s) => ({ ...s, brand: { ...s.brand, fontFamily: e.target.value } }))} className={inputCls}>
                  {FONT_OPTIONS.map((font) => (<option key={font} value={font}>{font}</option>))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
            <SectionLabel title="Brand Colors" subtitle="Core token colors used across the website." />
            <div className="p-6 grid grid-cols-3 gap-4">
              {([["primaryColor", "Primary Color"], ["secondaryColor", "Secondary Color"], ["accentColor", "Accent Color"]] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={settings.brand[key]} onChange={(e) => setSettings((s) => ({ ...s, brand: { ...s.brand, [key]: e.target.value } }))} className="w-10 h-10 rounded-lg border border-neutral-300 bg-white p-1" />
                    <input type="text" value={settings.brand[key]} onChange={(e) => setSettings((s) => ({ ...s, brand: { ...s.brand, [key]: e.target.value } }))} className={inputCls} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
              <SectionLabel title="Header" subtitle="Navbar layout, colors, and active page indicator." />
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Header Style</label>
                  <select value={settings.header.headerStyle || "classic"} onChange={(e) => setSettings((s) => ({ ...s, header: { ...s.header, headerStyle: e.target.value as any } }))} className={inputCls}>
                    <option value="classic">Classic — Logo left, nav right</option>
                    <option value="centered">Centered — Logo centered, nav below</option>
                    <option value="transparent">Transparent — Overlays hero, glass on scroll</option>
                  </select>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    {settings.header.headerStyle === "transparent" ? "Header overlays page content with frosted glass effect on scroll. Works best with a hero slider." : settings.header.headerStyle === "centered" ? "Two-tier layout with centered logo and centered navigation links." : "Standard horizontal navbar with logo on the left."}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Background Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={settings.header.bgColor} onChange={(e) => setSettings((s) => ({ ...s, header: { ...s.header, bgColor: e.target.value } }))} className="w-10 h-10 rounded-lg border border-neutral-300 bg-white p-1" />
                    <input type="text" value={settings.header.bgColor} onChange={(e) => setSettings((s) => ({ ...s, header: { ...s.header, bgColor: e.target.value } }))} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Navbar Font / Active Indicator Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={settings.header.navFontColor} onChange={(e) => setSettings((s) => ({ ...s, header: { ...s.header, navFontColor: e.target.value } }))} className="w-10 h-10 rounded-lg border border-neutral-300 bg-white p-1" />
                    <input type="text" value={settings.header.navFontColor} onChange={(e) => setSettings((s) => ({ ...s, header: { ...s.header, navFontColor: e.target.value } }))} className={inputCls} />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
              <SectionLabel title="Footer" subtitle="Privacy and Terms links are hidden when their URL is blank." />
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 border border-neutral-200">
                  <div>
                    <p className="text-xs font-medium text-neutral-700">Custom Footer Background</p>
                    <p className="text-[11px] text-neutral-500">Default inherits Primary color</p>
                  </div>
                  <button type="button" onClick={() => setSettings((s) => ({ ...s, footer: { ...s.footer, useCustomBg: !s.footer.useCustomBg } }))} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.footer.useCustomBg ? "bg-primary-500" : "bg-neutral-300"}`}>
                    <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm ${settings.footer.useCustomBg ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Background Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={settings.footer.useCustomBg ? settings.footer.bgColor : effectiveFooterBg} onChange={(e) => setSettings((s) => ({ ...s, footer: { ...s.footer, bgColor: e.target.value, useCustomBg: true } }))} className="w-10 h-10 rounded-lg border border-neutral-300 bg-white p-1" />
                    <input type="text" value={settings.footer.useCustomBg ? settings.footer.bgColor : effectiveFooterBg} onChange={(e) => setSettings((s) => ({ ...s, footer: { ...s.footer, bgColor: e.target.value, useCustomBg: true } }))} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Text Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={settings.footer.textColor} onChange={(e) => setSettings((s) => ({ ...s, footer: { ...s.footer, textColor: e.target.value } }))} className="w-10 h-10 rounded-lg border border-neutral-300 bg-white p-1" />
                    <input type="text" value={settings.footer.textColor} onChange={(e) => setSettings((s) => ({ ...s, footer: { ...s.footer, textColor: e.target.value } }))} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Privacy & Cookies URL</label>
                  <input type="text" value={settings.footer.privacyUrl} onChange={(e) => setSettings((s) => ({ ...s, footer: { ...s.footer, privacyUrl: e.target.value } }))} placeholder="https://example.com/privacy" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Terms & Conditions URL</label>
                  <input type="text" value={settings.footer.termsUrl} onChange={(e) => setSettings((s) => ({ ...s, footer: { ...s.footer, termsUrl: e.target.value } }))} placeholder="https://example.com/terms" className={inputCls} />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <SaveButton onClick={handleSave} saving={saving} />
          </div>
        </div>
      )}

      {/* ════════════════ PAGE MANAGER TAB ════════════════ */}
      {activeTab === "pages" && (
        <div>
          <div className="grid grid-cols-12 gap-6">
            {/* Pages list */}
            <div className="col-span-3">
              <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                <SectionLabel title="Pages" subtitle="All pages include visibility toggles." />
                <div className="divide-y divide-neutral-100">
                  {sortedPages.map((page, idx) => {
                    const active = page.id === selectedPage?.id;
                    return (
                      <div
                        key={page.id}
                        className={`px-3 py-3 cursor-pointer transition-colors ${active ? "bg-primary-50/60" : "hover:bg-neutral-50"}`}
                        onClick={() => { setSelectedPageId(page.id); setEditingComponentId(null); }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-1">
                            <button type="button" onClick={(e) => { e.stopPropagation(); movePage(page.id, -1); }} disabled={idx === 0} className="w-4 h-4 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-700 disabled:opacity-20" title="Move up">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>
                            </button>
                            <button type="button" onClick={(e) => { e.stopPropagation(); movePage(page.id, 1); }} disabled={idx === sortedPages.length - 1} className="w-4 h-4 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-700 disabled:opacity-20" title="Move down">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                            </button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-sm font-medium truncate ${active ? "text-primary-800" : "text-neutral-800"}`}>{page.title}</p>
                              {page.isBooking && <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-violet-100 text-violet-700">FORM</span>}
                            </div>
                            <p className="text-[11px] text-neutral-500 truncate">{page.slug}</p>
                          </div>
                          <button type="button" onClick={(e) => { e.stopPropagation(); togglePageVisibility(page.id); }} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${page.isVisible ? "bg-primary-500" : "bg-neutral-300"}`} title={page.isVisible ? "Hide page" : "Show page"}>
                            <span className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${page.isVisible ? "translate-x-5" : "translate-x-1"}`} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Selected page canvas */}
            <div className="col-span-9">
              {/* ── Services special page ── */}
              {selectedPage?.isServices ? (
                <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
                  <SectionLabel title="Services Page (Preset)" subtitle="Auto-generated from service data. No component sidebar." />
                  <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-end">
                    <select value={selectedService?.id || ""} onChange={(e) => setSelectedServiceId(e.target.value)} className="px-3 py-2 border border-neutral-300 rounded-lg text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500">
                      {DEMO_SERVICES.map((svc) => (<option key={svc.id} value={svc.id}>{svc.name}</option>))}
                    </select>
                  </div>

                  {selectedService && (
                    <div className="p-6 space-y-6">
                      {/* Hero */}
                      <div className="relative rounded-2xl overflow-hidden border border-neutral-200">
                        <div className="h-44 w-full bg-cover bg-center" style={{ backgroundImage: selectedService.heroImageUrl ? `linear-gradient(to top, rgba(0,0,0,0.68), rgba(0,0,0,0.28)), url(${selectedService.heroImageUrl})` : "linear-gradient(135deg, #0F52BA 0%, #1E88E5 55%, #1565C0 100%)" }} />
                        <div className="absolute inset-0 flex items-end">
                          <div className="p-6 text-white max-w-3xl">
                            <p className="text-xs font-semibold uppercase tracking-wider text-white/85 mb-1">Service</p>
                            <h4 className="text-2xl font-bold leading-tight">{selectedService.name}</h4>
                            <p className="text-sm text-white/90 mt-1 break-words">{selectedService.shortDescription}</p>
                          </div>
                        </div>
                      </div>

                      {/* Quick info */}
                      <div className="grid grid-cols-4 gap-3">
                        {[
                          ["Duration", `${selectedService.durationMinutes} min`],
                          ["Public Price", selectedService.pricePublic === null ? "Custom" : `£${selectedService.pricePublic}`],
                          ["Status", selectedService.status],
                          ["Category", selectedService.categoryId],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                            <p className="text-[11px] uppercase tracking-wide text-neutral-500 font-semibold">{label}</p>
                            <p className="text-lg font-semibold text-neutral-900 mt-0.5 capitalize">{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl border border-neutral-200 p-5">
                          <h5 className="text-sm font-semibold text-neutral-900 mb-3">Service Description</h5>
                          <div
                            className="text-sm text-neutral-700 leading-relaxed break-words overflow-hidden [&>p]:mb-3"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeHtml(
                                selectedService.fullDescriptionHtml || "<p>No description available.</p>",
                                SANITIZE_OPTIONS,
                              ),
                            }}
                          />
                        </div>
                        <div className="bg-white rounded-xl border border-neutral-200 p-5">
                          <h5 className="text-sm font-semibold text-neutral-900 mb-1">Booking & Scheduling</h5>
                          <p className="text-xs text-neutral-500 mb-3">Operational rules shown on the public service page.</p>
                          <div className="divide-y divide-neutral-100">
                            <KeyValueRow label="Duration" value={`${selectedService.durationMinutes} minutes`} />
                            <KeyValueRow label="Buffer" value={`${selectedService.bufferMinutes} minutes`} />
                            <KeyValueRow label="Booking Window" value={`${selectedService.bookingWindowDays} days`} />
                            <KeyValueRow label="Minimum Notice" value={`${selectedService.minNoticeHours} hours`} />
                            <KeyValueRow label="Capacity per Slot" value={`${selectedService.maxCapacityPerSlot}`} />
                            <KeyValueRow label="Waitlist" value={selectedService.allowWaitlist ? "Enabled" : "Disabled"} />
                            <KeyValueRow label="Cancellation Policy" value={selectedService.cancellationPolicy} />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl border border-neutral-200 p-5">
                          <h5 className="text-sm font-semibold text-neutral-900 mb-3">Clinical & Eligibility</h5>
                          <div className="divide-y divide-neutral-100">
                            <KeyValueRow label="Prescription Required" value={selectedService.requiresPrescription ? "Yes" : "No"} />
                            <KeyValueRow label="Age Range" value={`${selectedService.ageMin ?? "Any"} - ${selectedService.ageMax ?? "Any"}`} />
                            <KeyValueRow label="Gender" value={selectedService.genderRestriction} />
                            <KeyValueRow label="Consent Form" value={selectedService.consentFormRequired ? "Required" : "Not Required"} />
                            <KeyValueRow label="Pre-Appointment Instructions" value={selectedService.preAppointmentInstructions || "—"} />
                            <KeyValueRow label="Contraindications" value={selectedService.contraindicationsWarning || "—"} />
                          </div>
                        </div>
                        <div className="flex flex-col gap-4">
                          {/* Book Now button */}
                          <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl p-5 text-white">
                            <h5 className="text-sm font-semibold mb-1">Quick Booking</h5>
                            <p className="text-xs text-white/80 mb-4">Auto-selects this service and category — skips to provider selection.</p>
                            <button
                              type="button"
                              className="w-full py-3 rounded-lg bg-white text-primary-700 font-semibold text-sm hover:bg-white/90 transition-colors shadow-sm"
                              onClick={() => {
                                alert(`Booking: service=${selectedService.name}, category=${selectedService.categoryId}\n→ Redirects to /booking?service=${selectedService.id}&category=${selectedService.categoryId}&step=provider`);
                              }}
                            >
                              Book {selectedService.name} →
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              /* ── Booking form page ── */
              ) : selectedPage?.isBooking ? (
                <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
                  <SectionLabel title="Booking Page (Form)" subtitle="This page renders the booking form. No component sidebar." />
                  <div className="p-8 flex flex-col items-center justify-center min-h-[480px] text-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-neutral-900 mb-2">Booking Form</h4>
                    <p className="text-sm text-neutral-500 max-w-md">This page renders the multi-step booking wizard from the public site. The form auto-populates when accessed via a service &quot;Book Now&quot; button (service + category pre-selected, skipping to provider selection).</p>
                    <div className="mt-6 flex items-center gap-2 text-xs text-neutral-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" /></svg>
                      Components cannot be added to this page
                    </div>
                  </div>
                </div>

              /* ── Standard page with component sidebar ── */
              ) : (
                <div className="grid grid-cols-12 gap-4">
                  {/* Component sidebar */}
                  <div className="col-span-4">
                    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                      <SectionLabel title="Component Sidebar" subtitle="Add components to this page." />
                      <div className="p-3 space-y-2 max-h-[560px] overflow-y-auto">
                        {componentDefs.map((def) => {
                          const cat = CATEGORY_COLORS[def.category];
                          return (
                            <div key={def.id} className="p-3 rounded-lg border border-neutral-200 hover:border-neutral-300 transition-colors">
                              <div className="flex items-start gap-2">
                                <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={def.icon} /></svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium text-neutral-800 truncate">{def.name}</p>
                                    <button type="button" onClick={() => addComponentToPage(selectedPage.id, def)} className="w-6 h-6 rounded-md bg-primary-500 text-white flex items-center justify-center hover:bg-primary-600 transition-colors" title="Add to page">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                    </button>
                                  </div>
                                  <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{def.description}</p>
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium mt-2 ${cat.bg} ${cat.text}`}>{CATEGORY_LABELS[def.category]}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Page content */}
                  <div className="col-span-8">
                    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                      <SectionLabel title={`${selectedPage.title} — Component Stack`} subtitle="Click a component to configure it." />
                      <div className="p-4 space-y-3 min-h-[520px] bg-neutral-50/40">
                        {selectedPage.components.length === 0 ? (
                          <div className="h-full min-h-[420px] rounded-lg border-2 border-dashed border-neutral-300 flex items-center justify-center text-center px-6">
                            <div>
                              <p className="text-sm font-medium text-neutral-600">No components added yet</p>
                              <p className="text-xs text-neutral-500 mt-1">Use the component sidebar to add blocks.</p>
                            </div>
                          </div>
                        ) : (
                          selectedPage.components
                            .sort((a, b) => a.order - b.order)
                            .map((inst, idx) => {
                              const def = getDef(inst.defId);
                              if (!def) return null;
                              const cat = CATEGORY_COLORS[def.category];
                              const isEditing = editingComponentId === inst.id;
                              return (
                                <div key={inst.id} className={`bg-white rounded-lg border p-4 transition-all ${isEditing ? "border-primary-300 ring-2 ring-primary-500/15" : "border-neutral-200"}`}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div
                                      className="flex items-start gap-3 min-w-0 flex-1 cursor-pointer"
                                      onClick={() => setEditingComponentId(isEditing ? null : inst.id)}
                                    >
                                      <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={def.icon} /></svg>
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-semibold text-neutral-800">{idx + 1}. {def.name}</p>
                                          <svg className={`w-4 h-4 text-neutral-400 transition-transform ${isEditing ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
                                        </div>
                                        <p className="text-xs text-neutral-500 mt-0.5">{def.description}</p>
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium mt-2 ${cat.bg} ${cat.text}`}>{CATEGORY_LABELS[def.category]}</span>
                                      </div>
                                    </div>
                                    <button type="button" onClick={() => removeComponentFromPage(selectedPage.id, inst.id)} className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Remove component">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                                    </button>
                                  </div>
                                  {/* Expanded config panel */}
                                  {isEditing && (
                                    <div className="mt-4 pt-4 border-t border-neutral-200 space-y-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Component Configuration</p>
                                      {def.configFields.map((field) =>
                                        renderConfigField(
                                          field,
                                          inst.config,
                                          (key, val) => updateInstanceConfig(selectedPage.id, inst.id, key, val),
                                          (svcId) => toggleServiceInConfig(selectedPage.id, inst.id, svcId)
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <SaveButton onClick={handleSave} saving={saving} />
          </div>
        </div>
      )}

      {/* ════════════════ COMPONENT LIBRARY TAB ════════════════ */}
      {activeTab === "library" && (
        <div>
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-7">
              <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                <SectionLabel title="Component Definitions" subtitle="The single source of truth for components used in Page Manager and frontend." />
                <div className="p-4 grid grid-cols-2 gap-3 max-h-[640px] overflow-y-auto">
                  {componentDefs.map((def) => {
                    const cat = CATEGORY_COLORS[def.category];
                    const active = selectedComponent?.id === def.id;
                    return (
                      <button key={def.id} type="button" onClick={() => setSelectedComponentId(def.id)} className={`text-left p-4 rounded-lg border transition-all ${active ? "border-primary-300 bg-primary-50/50 ring-2 ring-primary-500/15" : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"}`}>
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={def.icon} /></svg>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-neutral-800">{def.name}</p>
                            <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{def.description}</p>
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium mt-2 ${cat.bg} ${cat.text}`}>{CATEGORY_LABELS[def.category]}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="col-span-5">
              {selectedComponent && (
                <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
                  <SectionLabel title={`${selectedComponent.name} Config`} subtitle="Default config applied whenever this component is added to any page." />
                  <div className="p-5 space-y-4">
                    {selectedComponent.configFields.map((field) =>
                      renderConfigField(
                        field,
                        selectedComponent.defaultConfig,
                        (key, val) => updateComponentDefConfig(selectedComponent.id, key, val),
                        (svcId) => toggleServiceInDefConfig(selectedComponent.id, svcId)
                      )
                    )}
                    <div className="pt-3 border-t border-neutral-200">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500 mb-2">Live Config JSON</p>
                      <pre className="text-xs text-neutral-700 bg-neutral-50 rounded-lg border border-neutral-200 p-3 overflow-x-auto">
                        {JSON.stringify(selectedComponent.defaultConfig, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end mt-6">
            <SaveButton onClick={handleSave} saving={saving} />
          </div>
        </div>
      )}
    </div>
  );
}
