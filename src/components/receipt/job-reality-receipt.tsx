import { PROVENANCE_DESCRIPTORS, summarizeProvenance } from "@/data/demo";
import type {
  DataSource,
  CommuteSegment,
  JobRealityAnalysis,
  TransportMode,
} from "@/domain/models";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const pesoDecimal = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * [ASSUMPTION] `summarizeProvenance` returns null when the analysis carried no
 * sources, which happens for a fully remote offer: no commute is routed, so no
 * transit source exists. The receipt still shows an estimated take-home figure,
 * so it stays labelled as an estimate rather than silently losing its badge.
 */
const NO_COMMUTE_DISCLOSURE = "Take-home pay is estimated. This offer has no onsite commute.";

/** Mode → icon character for the route timeline. Monospace-friendly symbols. */
const MODE_ICONS: Record<TransportMode, string> = {
  walk: "🚶",
  jeepney: "🚐",
  bus: "🚌",
  rail: "🚇",
  "uv-express": "🚐",
  p2p: "🚌",
  tricycle: "🛺",
  other: "•",
};

const MODE_LABELS: Record<TransportMode, string> = {
  walk: "Walk",
  jeepney: "Jeepney",
  bus: "Bus",
  rail: "Rail/MRT",
  "uv-express": "UV Express",
  p2p: "P2P Bus",
  tricycle: "Tricycle",
  other: "Other",
};

interface JobRealityReceiptProps {
  analysis: JobRealityAnalysis;
  /**
   * Stamped by the caller when the analysis landed. Reading the clock during
   * render is impure — the value would change on every re-render, so the issue
   * date is passed in instead.
   */
  issuedAt: Date;
}

/**
 * Renders a completed analysis as the Commute Reality Receipt, styled as a
 * used bus/train ticket with perforated edges, monospace typography, and a
 * route-segment timeline.
 *
 * Display only: every number here is read straight off `analysis`. This
 * component must never derive a business metric — formatting a value is fine,
 * computing one is not, because the deterministic engines are the only place
 * allowed to do that.
 */
export function JobRealityReceipt({ analysis, issuedAt }: JobRealityReceiptProps) {
  const provenance = summarizeProvenance(analysis.sources);
  const vintage = formatDataVintage(analysis.sources);
  const segments = analysis.commute.segments;
  const hasRoute = segments.length > 0;

  const burdenLevel = getBurdenLevel(analysis.commuteBurdenPercentage);
  // Derived from the offer id so the ticket number is stable for a given analysis.
  const ticketNumber = analysis.jobOffer.id
    .replace(/[^a-z0-9]/gi, "")
    .slice(-6)
    .toUpperCase();

  return (
    <section className="ticket" aria-label="Commute Reality Receipt">
      {/* Perforated top edge */}
      <div className="ticket-perforation ticket-perforation--top" aria-hidden="true" />

      {/* Ticket header */}
      <div className="ticket-body">
        <header className="ticket-header">
          <div className="ticket-logo">COMMUTE LENS</div>
          <div className="ticket-subtitle">COMMUTE REALITY TICKET</div>
          <div className="ticket-number">NO. {ticketNumber}</div>
        </header>

        <div className="ticket-divider" aria-hidden="true" />

        {/* Passenger / Job info */}
        <div className="ticket-section">
          <div className="ticket-field">
            <span className="ticket-label">PASSENGER</span>
            <span className="ticket-value">{analysis.jobOffer.title}</span>
          </div>
          <div className="ticket-field">
            <span className="ticket-label">COMPANY</span>
            <span className="ticket-value">{analysis.jobOffer.company}</span>
          </div>
          <div className="ticket-row">
            <div className="ticket-field">
              <span className="ticket-label">DESTINATION</span>
              <span className="ticket-value">{analysis.jobOffer.officeLocation.label}</span>
            </div>
            <div className="ticket-field">
              <span className="ticket-label">CLASS</span>
              <span className="ticket-value">
                {analysis.jobOffer.workArrangement === "remote"
                  ? "REMOTE"
                  : analysis.jobOffer.workArrangement === "hybrid"
                    ? "HYBRID"
                    : "DAILY"}
              </span>
            </div>
          </div>
          <div className="ticket-row">
            <div className="ticket-field">
              <span className="ticket-label">OFFICE DAYS</span>
              <span className="ticket-value">{analysis.commute.officeDaysPerMonth}/mo</span>
            </div>
            <div className="ticket-field">
              <span className="ticket-label">ISSUED</span>
              <span className="ticket-value">
                {issuedAt.toLocaleDateString("en-PH", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="ticket-divider" aria-hidden="true" />

        {/* Route timeline */}
        {hasRoute && (
          <div className="ticket-section">
            <div className="ticket-section-title">ROUTE</div>
            <RouteTimeline segments={segments} />
          </div>
        )}

        {hasRoute && <div className="ticket-divider" aria-hidden="true" />}

        {/* Fare breakdown */}
        <div className="ticket-section">
          <div className="ticket-section-title">FARE BREAKDOWN</div>
          <div className="ticket-fare-grid">
            <div className="ticket-fare-row">
              <span>Gross Salary</span>
              <span>{peso.format(analysis.jobOffer.monthlySalary)}</span>
            </div>
            <div className="ticket-fare-row">
              <span>Est. Take-Home</span>
              <span>{peso.format(analysis.estimatedTakeHomePay)}</span>
            </div>
            <div className="ticket-fare-row ticket-fare-row--subtle">
              <span>One-way fare</span>
              <span>{pesoDecimal.format(analysis.commute.oneWayFare)}</span>
            </div>
            <div className="ticket-fare-row ticket-fare-row--subtle">
              <span>Round trip</span>
              <span>{pesoDecimal.format(analysis.commute.dailyFare)}</span>
            </div>
            <div className="ticket-fare-row ticket-fare-row--highlight">
              <span>Monthly Transport</span>
              <span>−{peso.format(analysis.commute.monthlyFare)}</span>
            </div>
          </div>
        </div>

        {/* Notched divider — simulates the tear-off line */}
        <div className="ticket-tear" aria-hidden="true" />

        {/* The "totals" bottom stub */}
        <div className="ticket-section ticket-totals">
          <div className="ticket-total-row">
            <span className="ticket-total-label">INCOME AFTER COMMUTE</span>
            <span className="ticket-total-value">{peso.format(analysis.incomeAfterCommute)}</span>
          </div>
          <div className="ticket-total-row">
            <span className="ticket-total-label">MONTHLY COMMUTE TIME</span>
            <span className="ticket-total-value">
              {analysis.monthlyCommuteHours.toFixed(1)} hrs
            </span>
          </div>
          <div className="ticket-total-row">
            <span className="ticket-total-label">EFFECTIVE HOURLY</span>
            <span className="ticket-total-value">
              {pesoDecimal.format(analysis.effectiveHourlyValue)}/hr
            </span>
          </div>
        </div>

        <div className="ticket-divider" aria-hidden="true" />

        {/* Verdict stamp */}
        <div className="ticket-section ticket-verdict">
          <div className="ticket-burden-badge" data-level={burdenLevel.key}>
            {analysis.commuteBurdenPercentage.toFixed(1)}%
          </div>
          <div className="ticket-burden-text">
            <span className="ticket-burden-label">COMMUTE BURDEN</span>
            <span className="ticket-burden-desc">{burdenLevel.label}</span>
          </div>
        </div>

        <div className="ticket-divider" aria-hidden="true" />

        {/* Footer / provenance */}
        <footer className="ticket-footer">
          <div
            className="ticket-provenance-badge"
            data-tone={provenance ? provenance.weakest.tone : "caution"}
          >
            {provenance ? provenance.weakest.shortLabel.toUpperCase() : "ESTIMATED"}
          </div>
          <p className="ticket-disclaimer">
            {provenance ? provenance.weakest.disclosure : NO_COMMUTE_DISCLOSURE} Not payroll, tax,
            or financial advice.
            {provenance && provenance.sourceNames.length > 0
              ? ` Sources: ${provenance.sourceNames.join(", ")}.`
              : null}
            {vintage ? ` Data as of ${vintage}.` : null}
          </p>
          <p className="ticket-tagline">Know what the job really costs.</p>
        </footer>
      </div>

      {/* Perforated bottom edge */}
      <div className="ticket-perforation ticket-perforation--bottom" aria-hidden="true" />
    </section>
  );
}

/**
 * CL-014 — how old the underlying data is, for the footer disclosure.
 *
 * [ASSUMPTION] The task says M3 supplies provenance metadata and M2 renders it,
 * but it does not say which date to show when sources disagree. The earliest
 * wins here: a receipt must not imply its data is fresher than its oldest
 * input. If M3 would rather own this, it belongs on `ProvenanceSummary` and
 * this helper should go away.
 *
 * Selection and formatting only — no metric is derived here. Returns null when
 * no source dates itself, in which case the receipt omits the claim rather than
 * guessing one.
 */
function formatDataVintage(sources: readonly DataSource[]): string | null {
  // ISO-8601 dates sort lexicographically, so no parsing is needed to compare.
  const dated = sources
    .map((source) => source.effectiveDate)
    .filter((date): date is string => Boolean(date))
    .sort();
  if (dated.length === 0) return null;

  const earliest = new Date(dated[0]);
  if (Number.isNaN(earliest.getTime())) return null;

  return earliest.toLocaleDateString("en-PH", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * CL-014 — labels one segment with where its fare and duration came from.
 *
 * A route can mix provenance: a curated rail leg beside a jeepney fare that is
 * only estimated from a published band. Summarising the route with a single
 * badge would hide that, so every segment carries its own label. The visible
 * text is deliberately terse for the 80mm receipt; the full descriptor goes to
 * assistive tech and to the tooltip.
 */
function SegmentProvenance({ source }: { source: DataSource }) {
  const descriptor = PROVENANCE_DESCRIPTORS[source.type];

  return (
    <span className="route-stop-source" data-tone={descriptor.tone} title={descriptor.label}>
      <span className="sr-only">Data source: </span>
      {descriptor.shortLabel}
    </span>
  );
}

/** Route segment timeline component */
function RouteTimeline({ segments }: { segments: CommuteSegment[] }) {
  return (
    <div className="route-timeline" role="list" aria-label="Commute route segments">
      {segments.map((segment, index) => (
        <div className="route-stop" key={index} role="listitem">
          <div className="route-stop-marker">
            <span className="route-stop-dot" aria-hidden="true" />
            {index < segments.length - 1 && <span className="route-stop-line" aria-hidden="true" />}
          </div>
          <div className="route-stop-content">
            <div className="route-stop-station">{segment.origin.label}</div>
            <div className="route-stop-transport">
              <span className="route-stop-icon" aria-hidden="true">
                {MODE_ICONS[segment.mode]}
              </span>
              <span className="route-stop-mode">{MODE_LABELS[segment.mode]}</span>
              <SegmentProvenance source={segment.source} />
              <span className="route-stop-detail">
                {segment.estimatedDurationMinutes}min • {pesoDecimal.format(segment.estimatedFare)}
              </span>
            </div>
          </div>
        </div>
      ))}
      {/* Final destination */}
      {segments.length > 0 && (
        <div className="route-stop route-stop--final" role="listitem">
          <div className="route-stop-marker">
            <span className="route-stop-dot route-stop-dot--end" aria-hidden="true" />
          </div>
          <div className="route-stop-content">
            <div className="route-stop-station">
              {segments[segments.length - 1].destination.label}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getBurdenLevel(percentage: number): { key: string; label: string } {
  if (percentage <= 3) return { key: "very-low", label: "Very low commute burden" };
  if (percentage <= 7) return { key: "low", label: "Low commute burden" };
  if (percentage <= 12) return { key: "moderate", label: "Moderate commute burden" };
  if (percentage <= 20) return { key: "high", label: "High commute burden" };
  return { key: "very-high", label: "Very high commute burden" };
}
