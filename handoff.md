# VivIPractice - Handoff Document

## What It Does
VivIPractice (PharmaConnect) is an enterprise-grade, turnkey digital platform for pharmacies. It provides:
- **Public Website** — Patient-facing site with booking, services, and dynamic page builder
- **Pharmacy Dashboard** — Admin/staff portal for managing services, schedules, appointments, and website customization
- **Control Hub** — Vendor-only portal for provisioning and monitoring pharmacy instances
- **REST API** — NestJS backend powering all frontends

## Architecture
**Two-Plane Architecture:**
- **Control Plane** (multi-tenant, vendor-only) — Manages instances, feature flags, billing status. NO patient data.
- **Data Plane** (single-tenant, per pharmacy) — Each pharmacy gets its own isolated database, storage, and containerized deployment.

## Tech Stack
- **Monorepo:** Turborepo + npm workspaces
- **Frontend:** Next.js 15 (React 19) with TypeScript, Tailwind CSS
- **Backend:** NestJS 10 with Passport JWT, class-validator, Swagger
- **Database:** PostgreSQL via Prisma ORM
- **Storage:** S3-compatible (MinIO for local dev)
- **Containerization:** Docker, docker-compose for local dev

## Project Structure
```
vivipractice/
├── apps/
│   ├── api/           → NestJS backend (port 3001)
│   ├── dashboard/     → Pharmacy admin (port 3002)
│   ├── public-site/   → Patient-facing (port 3003)
│   └── control-hub/   → Super admin (port 3004)
├── packages/
│   ├── database/      → Prisma schema & client
│   ├── types/         → Shared TypeScript types
│   ├── ui/            → Shared component library
│   ├── eslint-config/ → Shared ESLint rules
│   └── tsconfig/      → Shared TS configs
├── docker/            → Dockerfiles & docker-compose
└── .env.example       → Environment variable template
```

## How to Run (Local Development)
1. **Prerequisites:** Node.js 20+, npm 11+, Docker
2. **Setup:**
   ```
   cp .env.example .env
   docker compose -f docker/docker-compose.yml up -d
   npm install
   npm run db:generate
   npm run db:push
   npm run seed
   ```
3. **Development:** `npm run dev` (starts all apps via Turborepo)
4. **Build:** `npm run build`
5. **Seed Database:** `npm run seed` — populates SiteSettings, BrandSettings, 5 default pages with full component stacks, and form fields
6. **Swagger Docs:** http://localhost:3001/api/docs (dev only)

## Production Deployment (AWS Lightsail)
Target: 2 GB RAM / 2 vCPUs / 60 GB SSD
Domains: `services.vivipractice.com` (public site) | `dashboard.vivipractice.com` (dashboard)

1. **DNS:** Create 2 A records both pointing to the Lightsail static IP:
   - `services.vivipractice.com` → Lightsail IP
   - `dashboard.vivipractice.com` → Lightsail IP
2. **Clone & configure:**
   ```
   git clone https://github.com/Verovian-PMR/pmr2.git vivipractice
   cd vivipractice
   cp .env.example .env   # Fill in POSTGRES_PASSWORD, JWT_SECRET
   ```
3. **SSL certificates:** Obtain a cert covering both subdomains and place in `docker/nginx/certs/`:
   ```
   # Option A: SAN cert for both subdomains
   sudo certbot certonly --nginx -d services.vivipractice.com -d dashboard.vivipractice.com
   # Option B: Wildcard cert (requires DNS challenge)
   sudo certbot certonly --manual --preferred-challenges dns -d "*.vivipractice.com" -d vivipractice.com
   ```
4. **Deploy:**
   ```
   docker compose -f docker-compose.prod.yml up -d --build
   ```
5. **Create admin user:**
   ```
   chmod +x scripts/create-admin.sh
   ./scripts/create-admin.sh
   ```
6. **Run migrations:**
   ```
   docker compose -f docker-compose.prod.yml exec api npx prisma db push --schema=packages/database/prisma/schema.prisma
   ```

**Subdomain routing (nginx):** Each subdomain has its own server block. Both proxy `/api/*` to the API service.
- `services.vivipractice.com` → Public Site (port 3003)
- `dashboard.vivipractice.com` → Dashboard (port 3002)

Memory limits: Postgres 384MB, API 384MB, Dashboard 384MB, Public-Site 384MB, Nginx 64MB (~1.6GB total).

## Key Design Decisions
1. **Single-tenancy per pharmacy** — Each pharmacy gets isolated DB + storage for HIPAA compliance
2. **JWT + MFA** — 15-min session expiry, TOTP-based MFA via otplib
3. **Immutable audit logs** — Every CUD action logged with user, timestamp, IP, and sanitized payload
4. **Page builder with JSON config** — Components stored as typed JSON in PostgreSQL, rendered dynamically
5. **Token-based design system** — Colors, spacing, typography defined as tokens in `packages/ui`
6. **No raw SQL** — All queries via Prisma (parameterized by default)

## Gotchas
- Prisma client must be regenerated after schema changes: `npm run db:generate`
- **Windows note:** npm workspaces are used instead of pnpm due to Windows symlink/junction issues. The `.npmrc` includes `install-links=true` and `legacy-peer-deps=true`.
- Tailwind token colors must match design tokens in `packages/ui/src/tokens.ts`
- The `BrandSettings` model is a singleton (always id = "brand_settings")
- Docker init-db.sql creates the control plane DB automatically
- Rate limiting is global via @nestjs/throttler (configurable via env vars)
- **API body limit:** JSON body parser is set to 50MB (`main.ts`) to accommodate base64 image data in services sync. Default Express limit (~100KB) is too small.
- **Services sync:** Dashboard `persistServices()` syncs the full services array (including base64 images) to the API via `PATCH /services-data`. The API stores this as a JSON blob in the `SiteSettings` table (id: `services_data`). Public-site components fetch via `GET /services-data`.

## Dashboard Features

### Shared Components
- **ConfirmModal** (`src/components/ConfirmModal.tsx`) — Reusable premium confirmation dialog with danger/warning variants. Used by all delete operations across Services, Settings, Inventory, and Schedule pages.
- **Drawer** (`src/components/Drawer.tsx`) — Reusable slide-in panel component used across Services, Schedule, and Appointments pages.

### Services Tab
Full CRUD for pharmacy services with a 6-step form wizard, data table with search/filter, preview drawer, category management, image dropzones (base64 via FileReader), and dynamic staff role / inventory item linking. On every create/edit/delete, the full services array is synced to the API so the public-site can display new services immediately.

### Schedule Tab
Provider schedule management page:
- **Provider list** with color-coded cards and selection state
- **Weekly hours grid** — toggle days on/off, view start/end times per day
- **Blocked dates** — add/remove blocked dates with reasons (uses ConfirmModal)
- **Edit drawer** — modify start/end times for each day via time inputs
- **RBAC** — role-based access control with demo user switcher. Providers can only edit their own schedule; admins can edit all. Non-authorized users see "View Only" badges and disabled controls.
- 4 demo users (admin + 3 providers) matching the public-site booking wizard

### Appointments Tab
Dual-view appointments management:
- **Calendar View** — Monthly grid with color-coded provider dots, Weekly time grid with appointment blocks, Daily list with full appointment cards. Click any date → opens a side drawer with appointment cards.
- **Table View** — Premium data table with search, status filter (confirmed/pending/completed/cancelled/no-show), provider filter. Row click → opens appointment detail drawer.
- **Reassignment** — Both drawers and daily view cards allow reassigning appointments to a different provider via dropdown.
- 18 demo appointments spread across March 2026.

### Locale & Display Conventions
- **Titles:** Pharmacist demo users use Mr/Mrs/Miss (not Dr.) — matches UK pharmacy conventions.
- **Dates:** All dates display in dd/mm/yyyy format (en-GB locale).
- **Currency:** All prices display with £ symbol (not currency code). The ServicePreviewDrawer `formatPrice` supports £, $, €, ₦ dynamically based on the service's `currency` field.

### Settings Tab
Staff roles CRUD (5 default roles). Roles appear in the service form's "Required Staff Role" dropdown.

### Inventory Tab
Full inventory management with data table, inline add/edit form, search, category filter, and stock status indicators.

### Website Tab
Full website customization hub with 3 horizontal sub-tabs. **Fully API-wired** — fetches settings/pages from API on mount, saves via `PATCH /site-settings` + `PUT /pages/bulk` (transactional). Loading spinner, error toast, success toast. Falls back to hardcoded defaults if API is unavailable.
- **Global Settings** — Branding (logo URL, favicon URL, font selector defaulting to Asap), brand color pickers (primary/secondary/accent), header settings (bgColor, navFontColor wired to active page indicator), footer settings (bgColor wired to primary by default with custom override toggle, textColor, Privacy & Cookies URL, Terms & Conditions URL — links hidden on frontend when URL is blank).
- **Page Manager** — Page list sidebar with show/hide toggles, reorder arrows, and FORM badge for Booking page. Three page modes:
  - *Standard pages* (Home, About, Contact) — Component sidebar + component stack canvas. Click any component to expand inline config panel with typed fields (multi-select services, layout selects, image/images dropzones, address search with OpenStreetMap preview, color pickers, toggles, textareas, etc.).
  - *Services page* (Preset) — No component sidebar. Fullwidth hero with gradient overlay, 4 stat cards, and panels for Description, Booking & Scheduling, Clinical & Eligibility. Operations and SEO sections removed. Includes "Book Now" button that auto-selects service + category → redirects to booking form at provider-selection step.
  - *Booking page* (Form) — No component sidebar. Informational placeholder explaining this page renders the booking form wizard. Accepts query params for service/category pre-selection.
- **Component Library** — 10 component definitions (5 PRD + 5 supplementary). Each has typed `configFields` schema controlling which inputs render. Clicking a component opens its default config panel. Changes are the single source of truth.
  - **PRD Components:** Home Slider (service multi-select, centered/left-aligned layouts), Services List Card (service multi-select, card display), 2 Column Content (rich text left, image/map right with layout options), Gallery (multi-image dropzone, grid/carousel modes), Dynamic Table (configurable headers, striped rows)
  - **Supplementary:** CTA Section, Testimonials, FAQ Accordion, Team Grid, Stats Bar
- **Config Schema** — `ConfigField` type system supports: text, textarea, color, number, select, multiselect-services, toggle, image (drag-and-drop dropzone with base64 + optional URL input, Change/Remove buttons), images, address, faq-items, table-rows. Conditional `showWhen` for dependent fields.
- Types: `website/types.ts` (BrandSettings, HeaderSettings, FooterSettings, GlobalSettings, SitePage, ComponentDef, ComponentInstance, ConfigField, ConfigFieldType)
- Data: `website/data.ts` (DEFAULT_SETTINGS, DEFAULT_PAGES, COMPONENT_LIBRARY with configFields)

### Profile Page
User profile page (`/profile`) accessible by clicking the user avatar at the bottom of the sidebar. Features:
- **Account Details** — Editable name, email, phone with avatar initials display
- **Change Password** — Current/new/confirm password form with validation (min 8 chars, match confirmation)
- Demo mode: shows success toasts without API calls

### Sidebar Navigation
Premium sidebar with grouped sections (Main: Website, Services, Schedule, Appointments | Management: Inventory, Settings). Form Builder is hidden. Active state with left accent bar, localStorage persistence. User avatar at bottom links to profile page.

## Public-Site Rendering

The public-site (`apps/public-site/`, port 3003) is fully driven by the dashboard's Page Manager configuration.

### Architecture
- **Data Layer** (`src/lib/site-config.ts` + `src/lib/api.ts`) — `fetchBrandSettings()` and `fetchPage(slug)` fetch from the API (`GET /site-settings`, `GET /pages?slug=...`) with ISR revalidation. Falls back to hardcoded defaults in `site-config.ts` if the API is unavailable.
- **Component Renderers** (`src/components/renderers/`) — 10 React components, one per component type, plus a `ComponentRenderer.tsx` mapper and a `ServicesPage.tsx` dedicated renderer.
- **Layout** — Header and footer dynamically styled from `GlobalSettings` (brand colors, font via Google Fonts, nav links auto-generated from visible pages, conditional Privacy/Terms links). Layout fetches settings from API.
- **Routing** — Home page fetches page via API and renders `ComponentInstance[]` via `ComponentRenderer`. Dynamic `[slug]` pages fetch from API and render accordingly (standard pages → components, services page → `ServicesPage`, booking → redirect to `/booking`).

### Services Data Pipeline
The public-site's service-dependent components (HomeSlider, ServicesListCard, ServicesPage, service detail pages) are wired to the API's `services-data` endpoint. Data flows:
1. Dashboard creates/edits a service → `persistServices()` saves to localStorage + syncs full array to API via `PATCH /services-data`
2. Public-site pages fetch services via `fetchServicesData()` (ISR revalidation 30s, or `no-store` for detail pages)
3. `ComponentRenderer` injects API services into HomeSlider and ServicesListCard via `config._services`
4. Both components show ALL non-archived services (featured first) when no specific `selectedServiceIds` are configured in the page manager

### Component Renderers
- **HomeSlider** — Full-width service slider with per-service hero image backgrounds, service name/description/price, Details + Book Now buttons. Two layout modes (centered vs left-aligned 50% width). Auto-advances every 6s with pause-on-hover, prev/next arrows, dot indicators, 2x height. Shows all non-archived services (featured first) when no specific IDs are selected.
- **ServicesListCard** — 3-col responsive grid of service cards with thumbnails, category labels, duration, price, and Book Now links. Same service selection logic as HomeSlider.
- **TwoColumnContent** — 50/50 layout: text left, image (full-width/circular) or OpenStreetMap embed right.
- **Gallery** — Multi-image grid (configurable columns) or horizontal scroll carousel. Dashboard uses drag-and-drop file input dropzone (multi-image upload via FileReader → data URLs) with thumbnail grid and remove buttons. Shows placeholders when empty.
- **DynamicTable** — Styled table with configurable headers, striped rows. Reads `config.rows` from Page Manager (falls back to demo opening-hours data). Dashboard uses editable `table-rows` field type.
- **CTASection** — Full-width call-to-action banner with heading + button. `buttonUrl` removed from config; always links to `/booking`.
- **Testimonials** — Card grid with star ratings and demo pharmacy testimonials.
- **FAQAccordion** — Client-side expandable accordion. Reads `config.items` from Page Manager (array of `{q, a}` objects; falls back to demo pharmacy FAQs). Dashboard uses editable `faq-items` field type.
- **TeamGrid** — Staff cards grid (matches the 3 demo providers from dashboard).
- **StatsBar** — Horizontal stats strip with key pharmacy numbers.
- **ServicesPage** — Dedicated services listing with search bar, category pill filters, and service cards with Details (green) and Book Now links. Search filters by service name and description.

### Service Detail Pages (`/services/[slug]`)
Dynamic detail page for each service, mirroring the dashboard's preset service page view from the Page Manager. Includes:
- Hero section with gradient overlay (or hero image background), category badge, service name and description
- 5 quick-info cards (Price, Duration, Booking Window, Capacity, Status)
- Service Description panel (renders `fullDescriptionHtml`)
- Booking & Scheduling panel (duration, buffer, booking window, min notice, capacity, waitlist, cancellation policy)
- Clinical & Eligibility panel (prescription required, age range, gender restriction, consent form, pre-appointment instructions, contraindications warning with amber alert)
- Gradient CTA card with Book Now button (auto-selects service + category)
- Back to All Services link

Default services have `generateStaticParams` for static generation. New dashboard-created services are resolved dynamically (`dynamicParams = true`) — `findService(slug)` fetches from the API with `cache: 'no-store'`, falling back to hardcoded defaults. Route: `/services/{slug}` (e.g. `/services/flu-vaccination`).

### Details Button
Green "Details" button (`bg-emerald-600`) appears next to the blue "Book Now" button on all service cards:
- `ServicesListCard.tsx` — homepage featured services grid
- `ServicesPage.tsx` — full services listing page
- `HomeSlider.tsx` — featured service tags are now clickable links to their detail pages

### Locale & Display Conventions (Public-Site)
All provider names use Mr/Mrs/Miss (not Dr.), prices display with £ symbol, consistent with dashboard.

## Mobile Responsiveness
The public-site is fully responsive:
- **Header** — Hamburger menu on mobile (`<md`) with full-screen dropdown navigation
- **HomeSlider** — Left-aligned layout constrains to 90% on mobile
- **Service cards** — Buttons stack vertically on small screens
- **Gallery** — Falls back to 2 columns on mobile
- **TeamGrid** — Falls back to 1 column on mobile, 2 on tablet
- **DynamicTable** — Horizontal scroll on narrow screens
- **StatsBar** — 2-column grid on mobile, 4 on desktop

## Double-Booking Prevention
The booking wizard prevents double-booking at both UI and API levels:
- **UI level:** DateTimeStep fetches booked slots from `GET /appointments/booked-slots?providerId=X&date=YYYY-MM-DD` and filters them out (including provider buffer time, default 15 min)
- **API level:** `POST /appointments` checks for overlapping PENDING/CONFIRMED appointments before creating
- **Data sources:** Booked slots merge DB appointments (from public booking) and appointments-data blob (synced from dashboard localStorage)
- Buffer time is configurable per provider in their schedule (`bufferMinutes` field)

## How to Extend
- **New API module:** Create `apps/api/src/modules/<name>/` with module, service, controller files. Register in `app.module.ts`.
- **New UI component:** Add to `packages/ui/src/components/`, export from `packages/ui/src/index.tsx`
- **New page:** Add route in the appropriate Next.js app under `src/app/`
- **New Prisma model:** Edit `packages/database/prisma/schema.prisma`, then `npm run db:generate` followed by `npm run db:push`
- **tsconfig paths:** All workspace package references use relative paths (not `node_modules` symlinks) due to Windows junction limitations. See each app's `tsconfig.json` for `paths` mappings.
