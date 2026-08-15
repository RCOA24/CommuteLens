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
- Optional offer-letter reading: upload the offer as a PDF, Word file, or photo and the form is
  prefilled with what the document states, each value shown next to the phrase it came from.
- Optional commuter memory: a saved home area, fare entitlement, and working assumptions, plus a
  running shortlist of analyzed offers instead of a two-at-a-time comparison.
- A closing summary reached by an explicit “Wrap up”, restating the figure and the hours behind it,
  with a next step chosen from what the person actually did.
- Animation that runs by default, with a one-click switch in the header that turns it off and stays
  off.

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
Geoapify / BusMaps / OpenAI / PaddleOCR / Backboard / demo provider adapters
```

Route previews are validated and reused by analysis so the preview and receipt cannot independently reroute or consume quota twice. AI receives calculated facts only and falls back to deterministic wording if unavailable or rejected by guardrails.

## The journey

The presentation layer is a single state machine in `commute-lens-experience.tsx`. Each step is its
own presentational component, so that file owns navigation, network calls, and entered values and
nothing else.

```text
intro → commute setup → route preview → offer details → calculating → reality
                                                                        ↓
                                                        compare ←→ wrap up → outro
```

Two constraints are deliberate. A remote arrangement skips route discovery entirely. And the outro is
reachable **only** from an explicit “Wrap up” on either the result or the comparison — finishing and
starting over are different intentions, so they get different controls, and nothing is lost by
finishing because the closing screen can return to the result.


## Setup

Requirements: Node.js 20.9+ and npm.

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Configure `BACKBOARD_API_KEY` to enable offer-letter reading and commuter memory. The key format is
plain: `BACKBOARD_API_KEY=<key>` with no quotes and no spaces around the `=`. `BACKBOARD_MODEL`
defaults to a cheap model on purpose, because the reader only transcribes fields. Set
`BACKBOARD_MEMORY=off` to keep reading but disable persistence.

Add `PADDLEOCR_API_KEY` to read photos and scans well. `PADDLEOCR_MODEL` defaults to `PP-StructureV3`
for speed; set it to `PaddleOCR-VL-1.6` when the inputs are poor phone photos. `PP-OCRv6` is not
supported, because its job result exposes no text field. Keep `PADDLEOCR_TIMEOUT_MS` below your
hosting platform's function `maxDuration`.

Geocoding selects Geoapify when `GEOAPIFY_API_KEY` is set and falls back to Nominatim otherwise;
`GEOCODING_PROVIDER` can force either, or `demo` for an offline rehearsal.

For an offline rehearsal, set both provider selectors to `demo`. For live routing, configure `BUSMAPS_API_KEY`; otherwise the server starts with the public archival GTFS route-pattern provider and falls back to distance when that dataset has no coverage. Set `TRANSIT_PROVIDER=gtfs` to test only the open-data path, or `OPEN_GTFS_ENABLED=false` to disable it. `OPEN_GTFS_URL` can point to another licensed GTFS ZIP.

Every integration key is server-side. Never expose Geoapify, BusMaps, Mobility, OpenAI, Backboard, or
PaddleOCR keys through `NEXT_PUBLIC_` variables. The Geoapify key also serves the same-origin
map-tile proxy, which exists so the browser never sees it.

## API

| Endpoint                           | Purpose                                                    |
| ---------------------------------- | ---------------------------------------------------------- |
| `POST /api/commute/route`          | Discover and normalize a route preview                     |
| `POST /api/commute/analyze`        | Analyze one offer, optionally reusing its route preview    |
| `POST /api/commute/compare`        | Compare two independently configured offers                |
| `POST /api/explain`                | Generate a guarded AI or deterministic explanation         |
| `POST /api/offer-document/extract` | Read an uploaded offer letter into a reviewable draft      |
| `POST /api/commuter-profile`       | Create, recall, update, extend, or delete commuter memory  |
| `GET /api/geocode/search?q=...`    | Explicit submitted place search                            |
| `POST /api/geocode/reverse`        | Reverse-geocode browser coordinates without URL parameters |

Expensive endpoints have a best-effort in-memory rate limit. A multi-instance production deployment should replace it with a shared rate-limit store.

## Offer-letter reading and commuter memory

Both features are additive and both are powered by [Backboard](https://docs.backboard.io). Without
`BACKBOARD_API_KEY` the app behaves exactly as before: the offer form is typed by hand and the
reading control reports that it is unavailable.

**Reading runs in two stages, and the split is the point.** Text is extracted first, then fields are
read out of that text:

```text
upload → local text extraction (PDF/DOCX) or PaddleOCR (photos, scans) → markdown text
                                                                              ↓
                                          Backboard field reader → guardrails → form prefill
```

Getting the source text first buys two things. Photos and scans are read far better by a dedicated OCR
pipeline than by a general model, and holding the text means every extracted figure can be verified
against it — a value the reader returns that does not appear in the source is marked unverified rather
than trusted. Both OCR models return markdown, which preserves the pay tables offer letters often use.
`PP-StructureV3` is the default because it is a layout pipeline rather than a vision-language model
doing a full pass per page, and an offer letter is usually an upright page of prose and a table;
`PaddleOCR-VL-1.6` reads creased, dim, and handwritten pages better and is worth the extra seconds when
the input is a bad phone photo. Without `PADDLEOCR_API_KEY` the document is sent to Backboard as an
attachment instead, so the feature degrades rather than disappearing. While a document is being read
the UI rotates through progress lines, because a long silent wait reads as a hang.

**Reading is transcription, not analysis.** The document reader may only copy what a document states.
It is explicitly forbidden to do arithmetic, so a stated annual salary is converted to a monthly
figure by `applyExtractionGuardrails`, not by the model, and the conversion is shown to the user.
Values outside plausible bounds are dropped rather than corrected, contradictory schedule fields are
dropped as a pair, and document text is stripped of control characters before it reaches a prompt or
the form. An extraction never reaches the analyzer directly: it prefills the form, and
`analyzeJobOfferSchema` remains the authority. The uploaded file is held in memory only, and its
Backboard thread is deleted as soon as the fields have been read.

**Memory is structured and auditable.** A profile is stored as one versioned, machine-readable record
and read back by parsing, never by semantic retrieval, because prefilling a form needs exact values.
Coordinates are rounded to three decimals (roughly 100 m) and labels truncated before anything is
written. Ledger entries are recalculated server-side from the analysis inputs, so a remembered
shortlist cannot drift from the receipt it came from. The UI can show every stored record verbatim.

Scoping is one Backboard assistant per anonymous commuter, and the assistant id is the handle held in
the browser's local storage. Possession of the handle is the whole authorization model — there are no
accounts — so handles are validated as UUIDs before they reach a provider URL, and deletion removes
the assistant and its memories in a single call. `forget` reports whether the deletion actually
succeeded instead of optimistically claiming it did. A handle whose assistant no longer exists is
treated as already gone: an upstream 404 resolves deletion and recall idempotently instead of
stranding the browser with a record it can neither read nor remove.

The memory panel supports the full set — save, view verbatim, replace, remove one offer, remove
everything — because a store the user cannot inspect or empty is not a feature they can consent to.

## Privacy and security

- Location is processed only for geocoding/routing and is not persisted by the app, **except** for a
  rounded home coordinate and label when the user explicitly asks to be remembered.
- Commuter memory is opt-in, is never written until the user asks for it, and is deletable from the
  UI. With `BACKBOARD_MEMORY=off`, or with no Backboard key, storage falls back to a process-local
  store that reports itself as session-only rather than implying durability.
- Uploaded offer documents are sent to Backboard for processing, are not written to disk by this app,
  and their processing thread is deleted after extraction.
- When `PADDLEOCR_API_KEY` is set, an uploaded document is also sent to PaddleOCR AI Studio for text
  extraction. The file is held in memory for the duration of the request only.
- A production privacy notice must name both Backboard and PaddleOCR AI Studio as processors for the
  document-reading and memory features.
- The animation preference is stored in the browser's local storage and is not sent anywhere.
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
2. Drop in a photographed offer letter, then point at the quotes: every prefilled field traces to a
   line in the document, unverified values are marked as such, and the annual-to-monthly conversion
   was done by Commute Lens, not by the model.
3. Enter an offer and explain the adjustable take-home assumption.
4. Reveal cash after transport, effective hourly value, burden, and monthly commute hours.
5. Move onsite days and state the marginal money/time impact.
6. Compare a second real offer and show that cash and effective-hourly leaders may differ.
7. Expand “How we calculated this” or request the guarded explanation.
8. Save the setup and add the offer to the shortlist, then open “Exactly what is stored” and delete
   it — the memory layer is auditable and reversible, not a black box.
9. Press “Wrap up” for the closing summary, then hit the header switch to show the same screen with
   motion off — the animation is a layer over the content, never the content itself.

## Current scope

This hackathon build intentionally excludes accounts, full Philippine payroll computation,
authoritative fare feeds, and trip booking. Persistence exists only as the opt-in commuter memory
described above, behind an anonymous browser-held handle rather than a login. The next data milestone is validated agency-specific GTFS/fare ingestion with coverage matching—not more presentation features.
