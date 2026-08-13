import { BriefcaseBusiness, Building2, CalendarDays, House, Moon } from "lucide-react";
import {
  DEFAULT_HYBRID_SCHEDULE,
  WEEKDAYS,
  WEEKDAY_LABELS,
  countOnsiteDays,
  countWorkingDays,
  scheduleForArrangement,
  sixDaySchedule,
  type DayWorkMode,
  type WeeklyWorkSchedule,
} from "@/domain/work-schedule";

const MODE_OPTIONS: Array<{
  value: DayWorkMode;
  label: string;
  shortLabel: string;
  icon: typeof Building2;
}> = [
  { value: "onsite", label: "Onsite", shortLabel: "Office", icon: Building2 },
  { value: "wfh", label: "Work from home", shortLabel: "WFH", icon: House },
  { value: "off", label: "Not working", shortLabel: "Off", icon: Moon },
];

const PRESETS = [
  { label: "Hybrid M/W/F", value: () => ({ ...DEFAULT_HYBRID_SCHEDULE }) },
  { label: "Mon–Fri onsite", value: () => scheduleForArrangement("onsite") },
  { label: "Six-day onsite", value: sixDaySchedule },
  { label: "Fully remote", value: () => scheduleForArrangement("remote") },
] as const;

export function WeeklyScheduleEditor({
  value,
  onChange,
  compact = false,
}: {
  value: WeeklyWorkSchedule;
  onChange: (value: WeeklyWorkSchedule) => void;
  compact?: boolean;
}) {
  const onsiteDays = countOnsiteDays(value);
  const workingDays = countWorkingDays(value);

  function setDay(day: (typeof WEEKDAYS)[number], mode: DayWorkMode) {
    onChange({ ...value, [day]: mode });
  }

  return (
    <fieldset className="weekly-schedule">
      <legend className="sr-only">Weekly work schedule</legend>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[0.64rem] font-black tracking-[0.14em] text-leaf uppercase">
            <CalendarDays className="size-3.5" aria-hidden="true" /> Your actual week
          </p>
          {!compact && (
            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-muted">
              Set every day as office, work from home, or off. Commute cost uses office days; paid
              work hours use every office and WFH day.
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2 text-center">
          <span className="rounded-[0.75rem] bg-ink px-3 py-2 text-paper">
            <strong className="numeric block text-sm text-mint">{onsiteDays}</strong>
            <span className="text-[0.55rem] font-black tracking-[0.08em] uppercase">Onsite</span>
          </span>
          <span className="rounded-[0.75rem] bg-paper px-3 py-2 ring-1 ring-ink/10">
            <strong className="numeric block text-sm">{workingDays}</strong>
            <span className="text-[0.55rem] font-black tracking-[0.08em] text-muted uppercase">
              Workdays
            </span>
          </span>
        </div>
      </div>

      {!compact && (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Schedule presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className="rounded-full border border-ink/15 bg-paper px-3 py-1.5 text-[0.62rem] font-black tracking-[0.06em] text-muted uppercase hover:border-accent hover:text-flame"
              onClick={() => onChange(preset.value())}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="schedule-day-row">
            <span className="w-10 shrink-0 text-xs font-black sm:w-20">
              <span className="sm:hidden">{WEEKDAY_LABELS[day].short}</span>
              <span className="hidden sm:inline">{WEEKDAY_LABELS[day].long}</span>
            </span>
            <div
              className="grid min-w-0 flex-1 grid-cols-3 gap-1"
              role="group"
              aria-label={WEEKDAY_LABELS[day].long}
            >
              {MODE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = value[day] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className="schedule-mode"
                    data-selected={selected}
                    data-mode={option.value}
                    aria-pressed={selected}
                    onClick={() => setDay(day, option.value)}
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                    <span className="hidden min-[430px]:inline">{option.shortLabel}</span>
                    <span className="sr-only">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {workingDays === 0 && (
        <p role="alert" className="field-error mt-3">
          <BriefcaseBusiness className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Select at least one onsite or work-from-home day.
        </p>
      )}
    </fieldset>
  );
}
