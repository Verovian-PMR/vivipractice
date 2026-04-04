import type { Metadata } from "next";
import "./globals.css";
import { DEFAULT_SETTINGS, DEFAULT_PAGES } from "@/lib/site-config";
import { fetchBrandSettings, fetchPages } from "@/lib/api";
import HeaderWrapper from "@/components/headers/HeaderWrapper";

export const metadata: Metadata = {
  title: "VivIPractice Pharmacy",
  description: "Book your appointment online",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getSettings() {
  try {
    const remote = await fetchBrandSettings();
    if (remote && typeof remote === "object" && "brand" in remote) return remote;
  } catch {}
  return DEFAULT_SETTINGS;
}

async function getPages() {
  try {
    const remote = await fetchPages();
    if (Array.isArray(remote) && remote.length > 0) {
      return remote
        .filter((p: any) => p.isVisible)
        .sort((a: any, b: any) => a.order - b.order);
    }
  } catch {}
  return DEFAULT_PAGES.filter((p) => p.isVisible).sort((a, b) => a.order - b.order);
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings: any = await getSettings();
  const font = settings.brand.fontFamily.replace(/\s+/g, "+");
  const footerBg = settings.footer.useCustomBg ? settings.footer.bgColor : settings.brand.primaryColor;
  const pages = await getPages();
  const navPages = pages.filter((p: any) => !p.isBooking);

  return (
    <html lang="en">
      <head>
        <link
          href={`https://fonts.googleapis.com/css2?family=${font}:wght@400;500;600;700&display=swap`}
          rel="stylesheet"
        />
      </head>
      <body
        className="antialiased bg-white text-neutral-900"
        style={{ fontFamily: `'${settings.brand.fontFamily}', system-ui, sans-serif` }}
      >
        {/* ── Header ── */}
        <HeaderWrapper settings={settings} navPages={navPages} />

        <main>{children}</main>

        {/* ── Footer ── */}
        <footer className="py-12 mt-16" style={{ backgroundColor: footerBg }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm" style={{ color: settings.footer.textColor }}>
            <p>&copy; {new Date().getFullYear()} VivIPractice. All rights reserved.</p>
            {(settings.footer.privacyUrl || settings.footer.termsUrl) && (
              <div className="flex justify-center gap-4 mt-3 opacity-80">
                {settings.footer.privacyUrl && (
                  <a href={settings.footer.privacyUrl} className="hover:underline" style={{ color: settings.footer.textColor }}>
                    Privacy &amp; Cookies
                  </a>
                )}
                {settings.footer.termsUrl && (
                  <a href={settings.footer.termsUrl} className="hover:underline" style={{ color: settings.footer.textColor }}>
                    Terms &amp; Conditions
                  </a>
                )}
              </div>
            )}
          </div>
        </footer>
      </body>
    </html>
  );
}
