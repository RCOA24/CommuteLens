"use client";
import { Check, CircleAlert, Target, WalletCards } from "lucide-react";
import { useId } from "react";
import type { CommuteViabilityPlan } from "@/domain/job/commute-viability";
import { dayWord, formatHours, formatPeso, scheduleLabel } from "./format";
/**
 * Presents a domain-produced plan; it never derives transport, allowance, or
 * salary amounts in the view. An allowance means a net reimbursement here,
 * rather than a taxable addition to gross salary.
 */
export function CommuteViabilityPlanner({
  plan,
  targetIncomeAfterCommute,
  onTargetIncomeAfterCommuteChange,
}: {
  plan: CommuteViabilityPlan | null;
  targetIncomeAfterCommute: number;
  onTargetIncomeAfterCommuteChange: (value: number) => void;
}) {
  const targetId = useId();
  return (
    <section className="mint-panel p-5 sm:p-7 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[0.62rem] font-black tracking-[0.14em] text-ink/65 uppercase">
            <Target className="size-3.5" aria-hidden="true" /> Commute viability planner
          </p>
          <h2 className="mt-2 font-headline text-2xl leading-none font-black tracking-[-0.03em] sm:text-3xl">
            Make the commute workable.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/70">
            Set the monthly cash you want left after transport. See the office-day schedules your
            current salary supports, or the allowance and salary floor that would close the gap.
          </p>
        </div>
        <WalletCards className="size-5 shrink-0 text-flame" aria-hidden="true" />
      </div>
      <div className="mt-6 max-w-sm">
        <label className="field-label" htmlFor={targetId}>
          Cash to keep after transport each month
        </label>
        <div className="currency-field">
          <span aria-hidden="true">₱</span>
          <input
            id={targetId}
            type="number"
            min="0"
            step="500"
            inputMode="numeric"
            value={targetIncomeAfterCommute}
            onChange={(event) => {
              const value = Number(event.target.value);
              onTargetIncomeAfterCommuteChange(Number.isFinite(value) && value >= 0 ? value : 0);
            }}
          />
        </div>
        <p className="field-hint">
          This is a cash target, not a suggested salary or a household budget.
        </p>
      </div>
      {plan ? <PlanResults plan={plan} /> : <RouteNeeded />}
    </section>
  );
}
function PlanResults({ plan }: { plan: CommuteViabilityPlan }) {
  const maximumDays = plan.maximumSustainableOnsiteDays;
  return (
    <>
      <div className="mt-5 rounded-[0.9rem] bg-paper/80 p-4 text-sm leading-relaxed text-ink/75">
        {maximumDays === null ? (
          <p>
            At the current advertised salary, this cash target is not met even with no office days.
            The table shows the gap a salary change can close.
          </p>
        ) : (
          <p>
            At the current advertised salary, you can keep at least{" "}
            {formatPeso(plan.targetIncomeAfterCommute)}
            after transport for up to{" "}
            <strong className="font-black text-ink">
              {maximumDays} office {dayWord(maximumDays)} a week
            </strong>
            .
          </p>
        )}
      </div>
      <div className="mt-5 overflow-x-auto rounded-[0.9rem] border border-ink/10 bg-paper/60">
        <table className="min-w-[650px] w-full text-left">
          <thead className="border-b border-ink/10 text-[0.6rem] font-black tracking-[0.12em] text-muted uppercase">
            <tr>
              <th scope="col" className="px-4 py-3">
                Schedule
              </th>
              <th scope="col" className="px-4 py-3">
                Current salary
              </th>
              <th scope="col" className="px-4 py-3">
                Net transport allowance
              </th>
              <th scope="col" className="px-4 py-3">
                Gross salary floor
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {plan.rows.map((row) => (
              <tr key={row.onsiteDaysPerWeek}>
                <th scope="row" className="px-4 py-3 align-top">
                  <span className="block text-sm font-black">
                    {scheduleLabel(row.onsiteDaysPerWeek)}
                  </span>
                  <span className="mt-0.5 block text-[0.7rem] font-normal text-muted">
                    {formatPeso(row.scenario.monthlyFare)} transport ·{" "}
                    {formatHours(row.scenario.monthlyCommuteHours)} travel
                  </span>
                </th>
                <td className="px-4 py-3 align-top text-sm">
                  {row.isFeasibleAtCurrentSalary ? (
                    <span className="inline-flex items-center gap-1.5 font-bold text-leaf">
                      <Check className="size-3.5" aria-hidden="true" /> Meets target
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 font-bold text-danger">
                      <CircleAlert className="size-3.5" aria-hidden="true" /> Below target
                    </span>
                  )}
                  <span className="numeric mt-1 block text-[0.72rem] text-muted">
                    {formatPeso(row.scenario.incomeAfterCommute)} left
                  </span>
                </td>
                <td className="numeric px-4 py-3 align-top text-sm font-black">
                  {formatPeso(row.minimumMonthlyCommuteAllowance)}
                  <span className="mt-1 block text-[0.68rem] font-normal text-muted">
                    {row.minimumMonthlyCommuteAllowance === 0
                      ? "No gap to reimburse"
                      : "to close the monthly gap"}
                  </span>
                </td>
                <td className="numeric px-4 py-3 align-top text-sm font-black">
                  {formatPeso(row.minimumGrossMonthlySalary)}
                  <span className="mt-1 block text-[0.68rem] font-normal text-muted">
                    per month
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 flex items-start gap-2 text-[0.7rem] leading-relaxed text-ink/65">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-flame" aria-hidden="true" />
        Allowance is shown as a net monthly reimbursement after deductions. Salary floors use your
        selected take-home estimate and exclude commute time; neither is payroll, tax, or financial
        advice.
      </p>
    </>
  );
}
function RouteNeeded() {
  return (
    <p className="mt-5 flex items-start gap-2 rounded-[0.9rem] bg-paper/80 p-4 text-sm leading-relaxed text-ink/75">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-flame" aria-hidden="true" />
      Search an onsite route with the office-day scenario control to price every viable arrangement.
      Commute Lens will not invent fares for an unresolved route.
    </p>
  );
}
