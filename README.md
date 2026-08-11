# Commute Lens

## CUTC: Transform Hackathon

Commute Lens is a Philippines-first decision-support tool that helps people understand the real cost of accepting a job.

> A higher salary does not automatically mean a better job.

The app combines salary, estimated take-home pay, commute cost, commute time, office attendance, and commute burden into a transparent **Commute Reality Receipt**.

## What it does

The current MVP foundation supports:

- deterministic job-offer and commute analysis;
- curated Metro Manila demo routes;
- commute cost and time calculations;
- estimated take-home pay and income after commute;
- commute-burden calculations;
- Job A vs Job B comparison logic;
- geocoding provider boundaries with demo and Nominatim support;
- AI-generated explanations that receive calculated facts only;
- a receipt-style homepage result;
- API validation and provider failure handling.

The transit path currently uses curated demo data behind the `TransitProvider` abstraction. BusMaps and Mobility Database credentials are documented for future provider integrations, but are not yet consumed by the application.

## Product flow

```text
Job offer
   ↓
Origin + office location
   ↓
Transit option
   ↓
Deterministic impact engine
   ↓
Job reality analysis
   ↓
Comparison / explanation / receipt
```

## Tech stack

- Next.js 16 with React 19
- TypeScript
- Zod runtime validation
- Vitest
- Tailwind CSS
- Server-side provider adapters

## Getting started

Requirements:

- Node.js 20.9 or newer
- npm

Install dependencies:

```bash
npm install
```

Copy the environment template:

```powershell
Copy-Item .env.example .env.local
```

Then add the integrations you want to enable. Secrets must remain server-side.

```env
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=your_model              # optional; the app has a default

# Optional geocoding configuration
GEOCODING_PROVIDER=demo              # use demo for offline rehearsal
NOMINATIM_ENDPOINT=                  # optional
NOMINATIM_USER_AGENT=CommuteLens/0.1 # recommended for Nominatim

# Reserved for future integrations; currently not read by the app
BUSMAPS_API_KEY=your_busmaps_key
MOBILITY_DATABASE_REFRESH_TOKEN=your_mobility_database_token
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API endpoints

The current backend endpoints are:

| Endpoint | Purpose |
|---|---|
| `POST /api/commute/analyze` | Analyze one job offer and commute |
| `POST /api/commute/compare` | Compare two job offers using the same engine |
| `POST /api/explain` | Explain an analysis or comparison using OpenAI when configured, otherwise deterministic fallback text |
| `GET /api/geocode/search` | Search for a location through the configured geocoder |
| `GET /api/geocode/reverse` | Reverse-geocode coordinates |

The API returns structured success/error responses and validates external input before it reaches domain calculations.

## Architecture

The project separates presentation, application, domain, and infrastructure responsibilities:

```text
Presentation
     ↓
Application use cases
     ↓
Domain calculations and models
     ↑
Infrastructure providers
```

Authoritative calculations never depend on AI or external provider response formats. Demo transit values carry demo/estimated provenance and are not presented as live or official data.

## AI behavior

OpenAI is an enhancement layer. It explains already-calculated facts and does not determine fares, routes, durations, salaries, scores, or the recommended job.

If `OPENAI_API_KEY` is missing or the provider is unavailable, the deterministic analysis remains available and the app uses a fallback explanation.

## Verification

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

The normal test suite does not require internet access or live third-party providers.

## Demo and limitations

This is a hackathon MVP. Transit values are curated Metro Manila demo estimates, not live routing, official fare data, payroll advice, tax advice, or financial advice. The demo provider is intentionally isolated so it can later be replaced with a validated GTFS or other transit implementation.

Do not commit `.env.local` or real credentials.

## Submission

Commute Lens is being submitted to **CUTC: Transform Hackathon**. The project prioritizes a reliable, explainable decision loop: show what a job offer looks like after accounting for the commute required to reach it.

