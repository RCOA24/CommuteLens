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
    <main>
      <section className="hero">
        <p className="eyebrow"></p>
        <h1>
          Your salary says one number.
          <br />
          Your commute tells the rest.
        </h1>
        <p>See the money and unpaid time a job commute takes before you decide.</p>
      </section>
      {result.success ? (
        <section className="receipt" aria-label="Commute Reality Receipt">
          <header>
            <p>COMMUTE LENS</p>
            <h2>JOB REALITY RECEIPT</h2>
          </header>
          <div className="rule" />
          <h3>{result.data.jobOffer.title}</h3>
          <p>{result.data.jobOffer.officeLocation.label}</p>
          <dl>
            <dt>Gross salary</dt>
            <dd>{peso.format(result.data.jobOffer.monthlySalary)}</dd>
            <dt>Est. take-home</dt>
            <dd>{peso.format(result.data.estimatedTakeHomePay)}</dd>
            <dt>Round trip</dt>
            <dd>{peso.format(result.data.commute.dailyFare)}</dd>
            <dt>Monthly transport</dt>
            <dd>−{peso.format(result.data.commute.monthlyFare)}</dd>
            <dt>Monthly commute</dt>
            <dd>{result.data.monthlyCommuteHours.toFixed(1)} hrs</dd>
          </dl>
          <div className="rule" />
          <dl className="total">
            <dt>Income after commute</dt>
            <dd>{peso.format(result.data.incomeAfterCommute)}</dd>
          </dl>
          <p className="burden">
            {result.data.commuteBurdenPercentage.toFixed(1)}% of estimated take-home pay
          </p>
          <p className="badge">DEMO / ESTIMATED</p>
          <small>Curated scenario; not live routing, payroll, tax, or financial advice.</small>
        </section>
      ) : (
        <p role="alert">{result.error.message}</p>
      )}
    </main>
  );
}
