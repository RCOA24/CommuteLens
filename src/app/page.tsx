import { AnalyzeJobOfferUseCase } from "@/application/analyze-job-offer/use-case";
import { DEMO_LOCATIONS } from "@/data/demo-routes";
import { MockTransitProvider } from "@/providers/transit/mock-transit.provider";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export default async function Home() {
  const result = await new AnalyzeJobOfferUseCase(new MockTransitProvider()).execute({
    origin: DEMO_LOCATIONS.cubao,
    jobOffer: {
      id: "demo-job-a",
      title: "Software Developer",
      company: "Demo Company",
      monthlySalary: 45_000,
      officeLocation: DEMO_LOCATIONS.bgc,
      workArrangement: "hybrid",
      onsiteDaysPerWeek: 3,
      workingHoursPerDay: 8,
    },
  });

  return (
    <main className="grid min-h-screen grid-cols-1 items-center gap-[clamp(2rem,6vw,7rem)] p-[clamp(2rem,6vw,6rem)] wide:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] print:block print:p-0">
      <section className="max-w-[760px] print:hidden">
        <p className="text-[0.8rem] font-extrabold tracking-[0.16em] text-accent"></p>
        <h1 className="mt-[0.6rem] mb-[1.2rem] text-[clamp(2.8rem,6vw,6.4rem)] leading-[0.94] tracking-[-0.06em]">
          Your salary says one number.
          <br />
          Your commute tells the rest.
        </h1>
        <p className="max-w-[570px] text-[clamp(1rem,2vw,1.3rem)] leading-[1.6]">
          See the money and unpaid time a job commute takes before you decide.
        </p>
      </section>
      {result.success ? (
        <section
          className="mx-auto w-full max-w-[440px] border-t-[10px] border-accent bg-paper p-8 [overflow-wrap:anywhere] shadow-[0_24px_80px_rgba(16,42,43,0.16)] wide:mx-0 wide:max-w-none print:mx-auto print:w-[80mm] print:max-w-full print:shadow-none"
          aria-label="Commute Reality Receipt"
        >
          <header className="text-center tracking-[0.12em]">
            <p className="font-black">COMMUTE LENS</p>
            <h2 className="text-base">JOB REALITY RECEIPT</h2>
          </header>
          <div className="my-5 border-t border-dashed border-ink" />
          <h3 className="mb-[0.2rem]">{result.data.jobOffer.title}</h3>
          <p className="mt-0 text-muted">{result.data.jobOffer.officeLocation.label}</p>
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <dt>Gross salary</dt>
            <dd className="text-right tabular-nums">
              {peso.format(result.data.jobOffer.monthlySalary)}
            </dd>
            <dt>Est. take-home</dt>
            <dd className="text-right tabular-nums">
              {peso.format(result.data.estimatedTakeHomePay)}
            </dd>
            <dt>Round trip</dt>
            <dd className="text-right tabular-nums">
              {peso.format(result.data.commute.dailyFare)}
            </dd>
            <dt>Monthly transport</dt>
            <dd className="text-right tabular-nums">
              −{peso.format(result.data.commute.monthlyFare)}
            </dd>
            <dt>Monthly commute</dt>
            <dd className="text-right tabular-nums">
              {result.data.monthlyCommuteHours.toFixed(1)} hrs
            </dd>
          </dl>
          <div className="my-5 border-t border-dashed border-ink" />
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 font-black">
            <dt>Income after commute</dt>
            <dd className="text-right tabular-nums">
              {peso.format(result.data.incomeAfterCommute)}
            </dd>
          </dl>
          <p className="bg-mint p-4 text-center font-extrabold">
            {result.data.commuteBurdenPercentage.toFixed(1)}% of estimated take-home pay
          </p>
          <p className="inline-block bg-ink px-[0.6rem] py-[0.35rem] text-[0.72rem] font-black tracking-[0.1em] text-white">
            DEMO / ESTIMATED
          </p>
          <small className="block leading-normal text-muted">
            Curated scenario; not live routing, payroll, tax, or financial advice.
          </small>
        </section>
      ) : (
        <p role="alert">{result.error.message}</p>
      )}
    </main>
  );
}
