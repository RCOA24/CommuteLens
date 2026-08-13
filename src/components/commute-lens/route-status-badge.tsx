import { Archive, BadgeCheck, CalendarClock, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { RouteStatusDescriptor, RouteStatusKind } from "./provenance";

const KIND_ICON: Record<RouteStatusKind, ReactNode> = {
  live: <BadgeCheck className="size-3.5 shrink-0" aria-hidden="true" />,
  scheduled: <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />,
  archival: <Archive className="size-3.5 shrink-0" aria-hidden="true" />,
  estimated: <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />,
  demo: <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />,
  remote: <Info className="size-3.5 shrink-0" aria-hidden="true" />,
};

/**
 * The provenance chip. Tone comes from the shared provenance descriptors, and
 * every tone is paired with a distinct icon and its own words so the status is
 * legible without colour perception.
 */
export function RouteStatusBadge({
  status,
  surface = "paper",
  className = "",
}: {
  status: RouteStatusDescriptor;
  surface?: "paper" | "ink";
  className?: string;
}) {
  return (
    <span
      className={`status-chip ${className}`}
      data-tone={status.tone}
      data-surface={surface === "ink" ? "ink" : undefined}
    >
      {KIND_ICON[status.kind]}
      {status.label}
    </span>
  );
}
