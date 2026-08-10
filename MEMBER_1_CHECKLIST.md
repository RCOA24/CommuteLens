# Member 1 — Tech Lead / Integration Checklist

This checklist tracks the Member 1 scope from `TEAM_TASKS.md`. Checkmarks reflect the current repository state as of implementation.

## CL-001 — Project foundation

- [x] Next.js, TypeScript, Tailwind, Zod, ESLint, Vitest, and Prettier configured.
- [x] Path alias, strict TypeScript, and build/test/lint/format scripts configured.
- [x] `.env.example` documents server-only provider secrets with placeholders.
- [x] Production build completes successfully.
- [ ] Commit the foundation on the Member 1 feature branch.

## CL-002 — Domain models and stable API contracts

- [x] Define provider-independent coordinate, location, job, commute segment, route, and provenance models.
- [x] Define `JobRealityAnalysis` as the authoritative output for receipt and explanation consumers.
- [x] Define typed API success/error results and application error codes.
- [x] Validate analysis input and normalized route data with Zod.
- [x] Reject route totals that do not equal the sum of segment fares and durations.
- [x] Keep provider-specific implementation details out of domain/application calculations.
- [ ] Review any contract changes requested by Members 2 or 3 before merging them.

## CL-007 — Commute calculation engine

- [x] Centralize weekly/monthly/annual attendance assumptions.
- [x] Calculate one-way, round-trip, monthly, and annual fares deterministically.
- [x] Calculate one-way, daily, monthly, and annual commute time using the same attendance model.
- [x] Handle zero-office-day/remote jobs without stale commute costs or time.
- [x] Reject invalid office-day frequencies.
- [ ] Add an explicit extremely-long-commute test case.

## CL-008 — Salary, effective-value, and commute-burden engine

- [x] Centralize the deterministic take-home estimate assumption.
- [x] Calculate income after commute, commute burden, monthly work hours, and effective hourly value.
- [x] Validate invalid financial inputs at the domain boundary.
- [x] Disclose in the UI that the take-home value is an estimate, not payroll or financial advice.
- [ ] Replace the MVP flat take-home estimate with a documented, versioned Philippine payroll-policy module if scope permits.

## CL-011 — Job A vs Job B comparison

- [x] Analyze both jobs through the same `AnalyzeJobOfferUseCase`.
- [x] Provide deterministic Job B minus Job A deltas for salary, take-home pay, commute cost/time, income after commute, burden, and effective hourly value.
- [x] Expose `POST /api/commute/compare`.
- [ ] Integrate the comparison result with Member 2's side-by-side UI.
- [ ] Confirm the UI does not label an authoritative “winner.”

## CL-017 — Tests and integration hardening

- [x] Unit-test commute, finance, validation, analysis, and comparison behavior.
- [x] Test remote/zero-day behavior, invalid attendance, invalid financial inputs, and malformed provider data.
- [x] Map provider exceptions to safe availability errors without leaking provider details.
- [x] Test analyze and compare API validation boundaries.
- [x] Verify formatting, TypeScript, ESLint, tests, and production build.
- [ ] Add integration tests once Member 2's form and Member 3's provider/dataset are merged.
- [ ] Add tests for long commutes, unsupported regions, and all curated demo scenarios.

## CL-018 — Final integration, deployment, and demo reliability

- [x] Keep the stable mock provider isolated behind `TransitProvider`.
- [x] Preserve `demo` provenance in analysis output.
- [x] Keep core analysis independent of AI.
- [ ] Integrate the selected geocoder/provider adapter and verify all error states.
- [ ] Verify receipt values are consumed directly from `JobRealityAnalysis` without recalculation.
- [ ] Verify provenance is visibly rendered in results, comparison, and receipt views.
- [ ] Run the complete hero flow on desktop and mobile.
- [ ] Configure deployment environment variables and run a deployed smoke test.
- [ ] Rehearse deterministic fallback scenarios for the final demo.

## Required checks before merge or demo

- [ ] `npm run format:check`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] No secrets, tokens, or unnecessary precise coordinates committed or logged.
- [ ] Demo/estimated transit data is never presented as live, official, or verified.
