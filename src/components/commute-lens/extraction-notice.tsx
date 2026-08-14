"use client";

import { BadgeCheck, MapPin, Quote, ScanText, TriangleAlert } from "lucide-react";
import type {
  ExtractedOfferFields,
  OfferDocumentExtraction,
} from "@/application/extract-offer-document/offer-extraction";
import type { Location } from "@/domain/models";
import { ActionButton } from "@/components/ui/action-button";
import { Eyebrow } from "@/components/ui/typography";
import { formatPeso, shortPlace } from "./format";

/**
 * What the document reader filled in, and what it refused to.
 *
 * The quotes are the point. A prefilled salary the user cannot trace back to a
 * line in their own offer letter is worse than an empty field, so each applied
 * value is shown next to the phrase the reader says it came from.
 */

const FIELD_LABEL: Record<keyof ExtractedOfferFields, string> = {
  title: "Job title",
  company: "Company",
  monthlySalary: "Gross monthly salary",
  workArrangement: "Work arrangement",
  onsiteDaysPerWeek: "Office days per week",
  workingDaysPerWeek: "Working days per week",
  workingHoursPerDay: "Paid hours per day",
  officeAddressQuery: "Office address",
};

const APPLIED_ORDER: readonly (keyof ExtractedOfferFields)[] = [
  "title",
  "company",
  "monthlySalary",
  "workArrangement",
  "onsiteDaysPerWeek",
  "workingDaysPerWeek",
  "workingHoursPerDay",
];

/** How the text was obtained, in the same spirit as the route provenance badges. */
const TEXT_SOURCE_LABEL: Record<OfferDocumentExtraction["textSource"], string> = {
  "text-layer": "Read directly from the file",
  ocr: "Read by OCR from a scan or photo",
  "document-upload": "Read by the document reader",
};

const TEXT_SOURCE_DISCLOSURE: Record<OfferDocumentExtraction["textSource"], string> = {
  "text-layer":
    "The characters came straight out of the file, and each value below was checked against that text.",
  ocr: "A scan or photo was recognized into text, and each value below was checked against that text. Recognition can still misread a smudged or skewed page.",
  "document-upload":
    "The file was read without a local copy of its text, so the values below could not be checked against the document.",
};

export function ExtractionNotice({
  extraction,
  officeCandidates,
  currentOfficeLabel,
  onUseOffice,
  onUndo,
}: {
  extraction: OfferDocumentExtraction;
  officeCandidates: readonly Location[];
  currentOfficeLabel: string;
  onUseOffice: (location: Location) => void;
  onUndo: () => void;
}) {
  const applied = APPLIED_ORDER.flatMap((field) => {
    const value = extraction.fields[field];
    if (value === null) return [];
    const quote = extraction.evidence.find((entry) => entry.field === field)?.quote ?? null;
    return [
      {
        field,
        display: displayValue(field, value),
        quote,
        isUnverified: extraction.unverifiedFields.includes(field),
      },
    ];
  });

  const suggestedOffice = officeCandidates[0];
  const officeDiffers =
    suggestedOffice !== undefined &&
    suggestedOffice.label.trim().toLowerCase() !== currentOfficeLabel.trim().toLowerCase();

  return (
    <section className="app-panel mx-auto max-w-5xl border-flame/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow tone="flame">Read from your document</Eyebrow>
          <h2 className="mt-2 font-headline text-lg font-black tracking-[-0.02em]">
            {applied.length === 0
              ? "Nothing was filled in"
              : `${applied.length} field${applied.length === 1 ? "" : "s"} filled in — please check ${applied.length === 1 ? "it" : "them"}`}
          </h2>
        </div>
        <ActionButton variant="quiet" onClick={onUndo}>
          Undo and clear
        </ActionButton>
      </div>

      <p className="mt-3 flex items-start gap-2 rounded-[1rem] bg-mint/35 p-3 text-xs leading-relaxed text-muted">
        <ScanText className="mt-0.5 size-3.5 shrink-0 text-flame" aria-hidden="true" />
        <span>
          <strong className="font-black text-ink">
            {TEXT_SOURCE_LABEL[extraction.textSource]}.
          </strong>{" "}
          {TEXT_SOURCE_DISCLOSURE[extraction.textSource]}
        </span>
      </p>

      {applied.length > 0 && (
        <ul className="mt-4 grid gap-2.5">
          {applied.map((entry) => (
            <li key={entry.field} className="app-inset p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[0.66rem] font-black tracking-[0.14em] text-muted uppercase">
                  {FIELD_LABEL[entry.field]}
                </span>
                <span className="numeric text-sm font-bold">{entry.display}</span>
              </div>
              {entry.quote && (
                <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-muted italic">
                  <Quote className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                  <span>{entry.quote}</span>
                </p>
              )}
              {extraction.verifiedAgainstSource &&
                (entry.isUnverified ? (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed font-bold text-flame">
                    <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                    <span>Not found word-for-word in the document. Confirm this one.</span>
                  </p>
                ) : (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                    <BadgeCheck className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                    <span>Found in the document text.</span>
                  </p>
                ))}
            </li>
          ))}
        </ul>
      )}

      {extraction.salaryConversion && (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          The document stated{" "}
          <strong className="font-black text-ink">
            {formatPeso(extraction.salaryConversion.statedAmount)}{" "}
            {extraction.salaryConversion.statedPeriod.replace("-", " ")}
          </strong>
          . Commute Lens converted that to a monthly figure — the reader did not do the arithmetic.
        </p>
      )}

      {extraction.warnings.length > 0 && (
        <ul className="mt-4 grid gap-2">
          {extraction.warnings.map((warning) => (
            <li
              key={warning}
              className="flex items-start gap-2 rounded-[1rem] bg-mint/35 p-3 text-xs leading-relaxed text-muted"
            >
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-flame" aria-hidden="true" />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}

      {officeDiffers && (
        <div className="mt-4 border-t border-ink/10 pt-4">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-flame" aria-hidden="true" />
            <span>
              The document points to{" "}
              <strong className="font-black text-ink">{shortPlace(suggestedOffice.label)}</strong>,
              which is not the office on file. Switching means pricing the commute again from the
              first step.
            </span>
          </p>
          <ActionButton
            variant="secondary"
            className="mt-3"
            onClick={() => onUseOffice(suggestedOffice)}
          >
            Use this office and re-price the commute
          </ActionButton>
        </div>
      )}
    </section>
  );
}

function displayValue(field: keyof ExtractedOfferFields, value: string | number): string {
  if (field === "monthlySalary" && typeof value === "number") return `${formatPeso(value)} / month`;
  if (field === "workingHoursPerDay") return `${value} hrs`;
  if (field === "onsiteDaysPerWeek" || field === "workingDaysPerWeek") {
    return `${value} day${value === 1 ? "" : "s"}`;
  }
  return String(value);
}
