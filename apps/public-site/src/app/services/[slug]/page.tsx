import { notFound } from "next/navigation";
import { getServiceBySlug, formatPrice, DEFAULT_SETTINGS } from "@/lib/site-config";
import { DEFAULT_CATEGORIES } from "@vivipractice/types";
import { fetchServicesData, getApiBaseUrl } from "@/lib/api";
import sanitizeHtml from "sanitize-html";

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
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

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-neutral-100 last:border-b-0">
      <span className="text-sm text-neutral-500">{label}</span>
      <span className="text-sm font-medium text-neutral-900">{value}</span>
    </div>
  );
}

async function findService(slug: string) {
  // Try API first (has dashboard-created services)
  // Use no-store to always get fresh data for detail pages
  try {
    const API_URL = getApiBaseUrl();
    const res = await fetch(`${API_URL}/services-data`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const found = data.find((s: any) => s.slug === slug);
        if (found) return found;
      }
    }
  } catch {}
  // Fall back to hardcoded defaults
  return getServiceBySlug(slug) ?? null;
}

export default async function ServiceDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const svc = await findService(slug);
  if (!svc) return notFound();

  const primary = DEFAULT_SETTINGS.brand.primaryColor;
  const secondary = DEFAULT_SETTINGS.brand.secondaryColor;
  const cat = DEFAULT_CATEGORIES.find((c) => c.id === svc.categoryId);

  return (
    <div>
      {/* ── Hero ── */}
      <section className="relative">
        <div
          className="h-56 md:h-72 w-full"
          style={
            svc.heroImageUrl
              ? { backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.68), rgba(0,0,0,0.28)), url(${svc.heroImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 55%, ${primary} 100%)` }
          }
        />
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 w-full">
            {cat && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white/20 text-white backdrop-blur-sm mb-2">
                {cat.name}
              </span>
            )}
            <h1 className="text-3xl md:text-4xl font-bold text-white">{svc.name}</h1>
            <p className="text-white/85 mt-2 max-w-2xl text-base break-words">{svc.shortDescription}</p>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* ── Quick Info Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
          {[
            ["Price", formatPrice(svc.pricePublic)],
            ["Duration", `${svc.durationMinutes} min`],
            ["Booking Window", `${svc.bookingWindowDays} days`],
            ["Capacity", `${svc.maxCapacityPerSlot} per slot`],
            ["Status", svc.isFeatured ? "Featured" : "Standard"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-[11px] uppercase tracking-wide text-neutral-500 font-semibold">{label}</p>
              <p className="text-lg font-semibold text-neutral-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* ── Service Description ── */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Service Description</h2>
            <div
              className="text-sm text-neutral-700 leading-relaxed break-words overflow-hidden [&>p]:mb-3"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(
                  svc.fullDescriptionHtml || "<p>No description available.</p>",
                  SANITIZE_OPTIONS,
                ),
              }}
            />
          </div>

          {/* ── Booking & Scheduling ── */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Booking & Scheduling</h2>
            <div>
              <InfoRow label="Duration" value={`${svc.durationMinutes} minutes`} />
              {svc.bufferMinutes > 0 && <InfoRow label="Buffer Time" value={`${svc.bufferMinutes} minutes`} />}
              <InfoRow label="Booking Window" value={`${svc.bookingWindowDays} days`} />
              <InfoRow label="Minimum Notice" value={`${svc.minNoticeHours} hours`} />
              <InfoRow label="Capacity per Slot" value={`${svc.maxCapacityPerSlot}`} />
              <InfoRow label="Waitlist" value={svc.allowWaitlist ? "Enabled" : "Disabled"} />
              <InfoRow label="Cancellation Policy" value={svc.cancellationPolicy} />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mt-8">
          {/* ── Clinical & Eligibility ── */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Clinical & Eligibility</h2>
            <div>
              <InfoRow label="Prescription Required" value={svc.requiresPrescription ? "Yes" : "No"} />
              <InfoRow label="Age Range" value={`${svc.ageMin ?? "Any"} – ${svc.ageMax ?? "Any"}`} />
              {svc.genderRestriction !== "any" && (
                <InfoRow label="Gender" value={svc.genderRestriction.charAt(0).toUpperCase() + svc.genderRestriction.slice(1)} />
              )}
              <InfoRow label="Consent Form" value={svc.consentFormRequired ? "Required" : "Not Required"} />
              {svc.preAppointmentInstructions && (
                <InfoRow label="Pre-Appointment" value={svc.preAppointmentInstructions} />
              )}
            </div>

            {svc.contraindicationsWarning && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 mt-4 flex items-start gap-2">
                <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                </svg>
                <p className="text-xs text-amber-700">{svc.contraindicationsWarning}</p>
              </div>
            )}
          </div>

          {/* ── Book Now CTA ── */}
          <div className="flex flex-col gap-4">
            <div
              className="rounded-xl p-6 text-white flex-1"
              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
            >
              <h2 className="text-lg font-semibold mb-2">Ready to Book?</h2>
              <p className="text-sm text-white/80 mb-6">
                Book this service online — select your preferred date, time, and provider.
              </p>
              <a
                href={`/booking?service=${svc.id}&category=${svc.categoryId}&name=${encodeURIComponent(svc.name)}`}
                className="block w-full py-3 rounded-lg bg-white font-semibold text-sm text-center transition-colors hover:bg-white/90 shadow-sm"
                style={{ color: primary }}
              >
                Book {svc.name} →
              </a>
            </div>

            {/* Back to services */}
            <a
              href="/services"
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-neutral-200 bg-white text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              Back to All Services
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
