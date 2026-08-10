# Member 3 — Backend / Data & AI Checklist

Tracks the Member 3 scope from the CUTC execution plan. Checkmarks reflect the current repository state.

## CL-005 — Curated Metro Manila demo dataset

- [x] Split the dataset into `locations`, `routes`, `scenarios`, and `sources` under `src/data/demo/`.
- [x] Cover 6 origins, 4 office districts, and 12 curated routes.
- [x] Derive `oneWayFare`, `oneWayDurationMinutes`, `transfers`, and `sources` from the segments via `buildRoute` so totals cannot drift from `commuteRouteSchema`.
- [x] Label every segment `demo` or `estimated`; nothing is presented as live or official.
- [x] Round coordinates to ~10 m so no exact address is committed.
- [x] Keep `@/data/demo-routes` working as a re-export for existing imports.
- [ ] Have Member 1 sanity-check the fare bands before the rehearsal.

## CL-006 — TransitProvider and demo provider

- [x] Replace exact-coordinate matching with proximity matching (6 km origin, 2 km destination).
- [x] Keep the destination radius tight enough that BGC and Makati CBD stay distinct.
- [x] Order candidates deterministically: nearest corridor, then cheapest, then fastest, then id.
- [x] Validate curated routes at the provider boundary so malformed data cannot reach the engines.
- [x] Distinguish "outside demo coverage" (`unsupported`) from "curated data is broken" (`unavailable`).
- [x] Add a bounded TTL cache keyed on coarse coordinates.
- [x] Leave `TransitProvider` itself unchanged — the contract is Member 1's.
- [ ] Revisit the radii once Member 2's location UX shows what users actually geocode to.

## CL-004 — Geocoding adapter and normalization (backend half)

- [x] Nominatim adapter with PH `countrycodes` and viewbox bias, server-side only.
- [x] Respect the Nominatim usage policy: identifying User-Agent, serialised requests, ~1 req/s.
- [x] Timeout, abort handling, and 24 h response caching.
- [x] Normalize upstream payloads to `Location`; no provider field reaches the domain layer.
- [x] Offline `DemoGeocodingProvider` over the curated locations for network-free rehearsal.
- [x] `FallbackGeocodingProvider` degrades on provider fault but not on a legitimate empty result.
- [x] Expose `GET /api/geocode/search` and `GET /api/geocode/reverse`.
- [x] Log the failure reason only — never the query, the coordinate, or the upstream body.
- [ ] Wire Member 2's location UI to these endpoints (CL-004 frontend half).

## CL-010 — AI explanation service

- [x] `/api/explain` accepts analysis _inputs_ and runs the deterministic engines first, so the AI can only describe authoritative numbers.
- [x] `ExplanationFacts` is the only shape the AI sees: calculated values, no routes, no raw request.
- [x] Sanitize and length-cap user-supplied job title and company before they enter a prompt.
- [x] Output guardrails reject invented numbers, decision language, and over-long text.
- [x] Every failure path returns the deterministic explanation; `execute` never throws.
- [x] OpenAI adapter uses `fetch`, so no vendor SDK sits in the request path.
- [x] Key is server-side only and never returned, logged, or echoed.
- [ ] Tune the prompt against a real key once one is provisioned.

## CL-014 — Data provenance (data half)

- [x] `PROVENANCE_DESCRIPTORS` supplies label, short label, tone, and disclosure copy per source type.
- [x] `summarizeProvenance` headlines the weakest source present and flags when disclosure is required.
- [x] Provenance labels are carried into the AI facts and the deterministic explanation.
- [ ] Confirm Member 2 renders the descriptors in results, comparison, and receipt.

## CL-016 — Demo seed scenarios

- [x] Six deterministic scenarios: hero, comparison B, worst case, short commute, remote baseline, unsupported corridor.
- [x] Inputs only — no fares, durations, or scores are hard-coded in scenario data.
- [x] Includes deliberate failure-state rehearsal (`unsupported-corridor`).
- [ ] Rehearse all six with the full team.

## Verification run

- [x] `npx prettier --check .`
- [x] `npx tsc --noEmit`
- [x] `npx eslint .`
- [x] `npx vitest run` — 74 tests passing
- [x] `npx next build` — production build succeeds, all 5 API routes registered
- [x] No secrets committed; `.env.example` documents server-only variables with empty values

## Known limitations to report in the PR

- Fare and duration values are curated approximations, not operator-verified.
- `transfers` counts every segment boundary, including walking legs, because that is what the shared contract specifies.
- Nominatim's live path is untested against the real service from this environment; the demo fallback covers it.
- The AI prompt has not been tuned against a live model.
