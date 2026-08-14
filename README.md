# CommuteLens

> **CUTC Transform Hackathon 2026 submission**

## The problem: a salary is not the full value of a job

For many Filipino workers, accepting a job is also a daily transportation decision. A higher salary can disappear into fares, fuel, parking, and ride-hailing costs. Long transfers and traffic can consume hours every week—time taken away from sleep, family, study, and personal recovery. Yet most job comparisons show only the monthly salary and hide the cost of getting to work.

This creates a practical information gap, especially for workers comparing onsite, hybrid, and remote opportunities across Metro Manila and nearby communities. The “better” offer on paper may leave someone with less money, less usable time, and a heavier daily burden.

## The solution: CommuteLens

CommuteLens is a Philippines-first job decision tool that turns commute conditions into an understandable part of offer evaluation. It combines a job offer, work arrangement, commute route, transport cost, and travel time to estimate what the opportunity is worth in real life—not just what it pays on paper.

Instead of telling people which job to choose, CommuteLens helps them ask better questions:

- How much take-home pay remains after getting to work?
- How many hours each month will the commute consume?
- Does a higher salary still lead to a higher effective hourly value?
- How does the answer change across 0–5 onsite days per week?
- Which of two offers is more sustainable for this person’s actual routine?

This project is submitted to the **CUTC Transform Hackathon 2026**, with a focus on using technology and responsible data interpretation to make everyday work decisions more transparent and grounded in lived experience.

## What users get

- Live BusMaps route timing when configured, with explicitly estimated fares.
- Archival DOTC/Sakay Metro Manila GTFS stop and connection patterns as an independent open-data fallback.
- Geoapify-powered address search, reverse geocoding, and an interactive route-stop map.
- Estimated monthly take-home after transport.
- Effective hourly value that counts both work and commute hours.
- A 0–5 onsite-day scenario explorer, including remote baselines.
- A real two-offer comparison with independent locations and work arrangements.
- AI or deterministic explanations based only on validated calculated facts.
- Visible Live, Estimated, or Curated Demo provenance.

Commute Lens does not choose a job, calculate official payroll deductions, or claim official/current fares.

## Calculation methodology

```text
estimated take-home = gross monthly salary × user-selected take-home percentage
monthly onsite days = onsite days/week × 52 ÷ 12
monthly transport = estimated one-way fare × 2 × monthly onsite days
monthly commute hours = one-way minutes × 2 × monthly onsite days ÷ 60
cash after transport = estimated take-home − monthly transport
effective hourly value = cash after transport ÷ (monthly work hours + commute hours)
commute burden = monthly transport ÷ estimated take-home × 100
```

The default take-home percentage is 90%, but it is an adjustable planning assumption—not a tax or payroll calculation. Commute time changes effective hourly value; it is not deducted from cash.

## Data and fallback behavior

- **Live route:** BusMaps supplies itinerary legs and timing. Because its route response does not quote fares, Commute Lens labels mode-based fare values as low-confidence estimates.
- **Published open-data route pattern:** if live routing is unavailable or has no coverage, the server loads the public DOTC/Sakay Metro Manila GTFS archive, finds nearby stops, and searches direct or one-transfer patterns. The feed calendar ended in 2020, so the UI labels these results archival and estimates access walking, transfer waiting, and fares. It never calls them current service.
- **Distance estimate:** used after the configured routing sources confirm a coverage gap. It assumes straight-line distance, 18 km/h city travel, 12 minutes of access/waiting, and an estimated fare formula.
- **Provider failure:** if every configured source fails operationally, the outage remains explicit rather than masquerading as route data.
- **Curated demo:** enabled only with `TRANSIT_PROVIDER=demo` and/or `GEOCODING_PROVIDER=demo`.
- **Mobility Database:** `mdb-1106` catalogs the same Sakay/DOTC feed used by the open-data provider. `mdb-1269` is deprecated and is intentionally excluded. The server caches one validated, bounded ZIP extraction per process.

### Open transit sources

- [BusMaps Metro Manila feed](https://busmaps.com/en/philippines/Philippine-Transit-App-Challenge/metro-manila) — live/enriched data remains behind the configured BusMaps API.
- [Mobility Database mdb-1106](https://mobilitydatabase.org/feeds/gtfs/mdb-1106) — catalog entry for the DOTC/Sakay Metro Manila feed.
- [Sakay Metro Manila GTFS](https://github.com/sakayph/gtfs) — archive downloaded by the static fallback. Its DOTC developer license permits transit-rider applications but is not an unrestricted SPDX open-source license.
- [Mobility Database mdb-1269](https://mobilitydatabase.org/feeds/gtfs/mdb-1269) — deprecated duplicate/older feed; documented but not routed.

The supplied feeds are Metro Manila-focused. They do not establish reliable Bulacan coverage, so trips such as Guiguinto to E-Med remain clearly labelled distance estimates unless a live provider returns an itinerary.

Geoapify search runs only after the user submits a query. The interactive map gets Geoapify tiles through a same-origin server proxy, so the key is never sent to the browser; it shows provider-returned stop locations as a dashed overview—not fabricated road geometry.

## Architecture

```text
Next.js presentation
        ↓
API route handlers + validation + rate limits
        ↓
Application use cases
        ↓
Domain calculations and models
        ↓
Geoapify / BusMaps / OpenAI / demo provider adapters
```

Route previews are validated and reused by analysis so the preview and receipt cannot independently reroute or consume quota twice. AI receives calculated facts only and falls back to deterministic wording if unavailable or rejected by guardrails.

## Setup

Requirements: Node.js 20.9+ and npm.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For an offline rehearsal, set both provider selectors to `demo`. For live routing, configure `BUSMAPS_API_KEY`; otherwise the server starts with the public archival GTFS route-pattern provider and falls back to distance when that dataset has no coverage. Set `TRANSIT_PROVIDER=gtfs` to test only the open-data path, or `OPEN_GTFS_ENABLED=false` to disable it. `OPEN_GTFS_URL` can point to another licensed GTFS ZIP. Configure `GEOAPIFY_API_KEY` for server-side geocoding and the same-origin map-tile proxy. Never expose Geoapify, BusMaps, Mobility, or OpenAI keys through `NEXT_PUBLIC_` variables.

## API

| Endpoint                        | Purpose                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| `POST /api/commute/route`       | Discover and normalize a route preview                     |
| `POST /api/commute/analyze`     | Analyze one offer, optionally reusing its route preview    |
| `POST /api/commute/compare`     | Compare two independently configured offers                |
| `POST /api/explain`             | Generate a guarded AI or deterministic explanation         |
| `GET /api/geocode/search?q=...` | Explicit submitted place search                            |
| `POST /api/geocode/reverse`     | Reverse-geocode browser coordinates without URL parameters |

Expensive endpoints have a best-effort in-memory rate limit. A multi-instance production deployment should replace it with a shared rate-limit store.

## Privacy and security

- Location is processed only for geocoding/routing and is not persisted by the app.
- Coordinates are sent to Geoapify and BusMaps when those providers are enabled.
- Browser geolocation requires an explicit click and reports low-accuracy results.
- Reverse-geocoding coordinates are sent in a POST body rather than a logged query string.
- Secrets remain server-side; `.env.local` is ignored by Git.
- Security, referrer, content-type, framing, and permissions headers are configured.

A production privacy notice should name the selected hosting provider and its request-log retention policy.

## Verification

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm audit
```

Unit and route-handler tests run without requiring live third-party calls.

## 60-second demo

1. Search and select a real origin and office, then show the route-status badge.
2. Enter an offer and explain the adjustable take-home assumption.
3. Reveal cash after transport, effective hourly value, burden, and monthly commute hours.
4. Move onsite days and state the marginal money/time impact.
5. Compare a second real offer and show that cash and effective-hourly leaders may differ.
6. Expand “How we calculated this” or request the guarded explanation.

## Current scope

This hackathon build intentionally excludes accounts, persistence, full Philippine payroll computation, authoritative fare feeds, and trip booking. The next data milestone is validated agency-specific GTFS/fare ingestion with coverage matching—not more presentation features.
