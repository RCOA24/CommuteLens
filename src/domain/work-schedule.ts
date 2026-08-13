import type { WorkArrangement } from "@/domain/models";

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];
export type DayWorkMode = "onsite" | "wfh" | "off";
export type WeeklyWorkSchedule = Record<Weekday, DayWorkMode>;

export const WEEKDAY_LABELS: Record<Weekday, { short: string; long: string }> = {
  monday: { short: "Mon", long: "Monday" },
  tuesday: { short: "Tue", long: "Tuesday" },
  wednesday: { short: "Wed", long: "Wednesday" },
  thursday: { short: "Thu", long: "Thursday" },
  friday: { short: "Fri", long: "Friday" },
  saturday: { short: "Sat", long: "Saturday" },
  sunday: { short: "Sun", long: "Sunday" },
};

export const DEFAULT_HYBRID_SCHEDULE: Readonly<WeeklyWorkSchedule> = Object.freeze({
  monday: "onsite",
  tuesday: "wfh",
  wednesday: "onsite",
  thursday: "wfh",
  friday: "onsite",
  saturday: "off",
  sunday: "off",
});

export function scheduleForArrangement(arrangement: WorkArrangement): WeeklyWorkSchedule {
  const weekdayMode: DayWorkMode = arrangement === "remote" ? "wfh" : "onsite";
  if (arrangement === "hybrid") return { ...DEFAULT_HYBRID_SCHEDULE };
  return {
    monday: weekdayMode,
    tuesday: weekdayMode,
    wednesday: weekdayMode,
    thursday: weekdayMode,
    friday: weekdayMode,
    saturday: "off",
    sunday: "off",
  };
}

export function sixDaySchedule(): WeeklyWorkSchedule {
  return {
    monday: "onsite",
    tuesday: "onsite",
    wednesday: "onsite",
    thursday: "onsite",
    friday: "onsite",
    saturday: "onsite",
    sunday: "off",
  };
}

export function countOnsiteDays(schedule: WeeklyWorkSchedule): number {
  return WEEKDAYS.filter((day) => schedule[day] === "onsite").length;
}

export function countWorkingDays(schedule: WeeklyWorkSchedule): number {
  return WEEKDAYS.filter((day) => schedule[day] !== "off").length;
}

export function deriveWorkArrangement(schedule: WeeklyWorkSchedule): WorkArrangement {
  const onsite = countOnsiteDays(schedule);
  const working = countWorkingDays(schedule);
  if (onsite === 0) return "remote";
  if (onsite === working) return "onsite";
  return "hybrid";
}

export function scheduleFromLegacy(
  arrangement: WorkArrangement,
  onsiteDaysPerWeek: number,
): WeeklyWorkSchedule {
  if (arrangement === "remote") return scheduleForArrangement("remote");
  const schedule = scheduleForArrangement("remote");
  for (const day of WEEKDAYS.slice(0, Math.min(7, Math.max(0, onsiteDaysPerWeek)))) {
    schedule[day] = "onsite";
  }
  return schedule;
}

export function compactScheduleLabel(schedule: WeeklyWorkSchedule): string {
  const onsite = WEEKDAYS.filter((day) => schedule[day] === "onsite").map(
    (day) => WEEKDAY_LABELS[day].short,
  );
  const wfh = WEEKDAYS.filter((day) => schedule[day] === "wfh").map(
    (day) => WEEKDAY_LABELS[day].short,
  );
  const off = WEEKDAYS.filter((day) => schedule[day] === "off").map(
    (day) => WEEKDAY_LABELS[day].short,
  );
  return [
    onsite.length ? `${onsite.join("/")} onsite` : null,
    wfh.length ? `${wfh.join("/")} WFH` : null,
    off.length ? `${off.join("/")} off` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
