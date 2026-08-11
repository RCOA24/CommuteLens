import { JobOfferAnalyzer } from "@/components/job-offer/job-offer-analyzer";

export default function Home() {
  return (
    <main className="grid min-h-screen grid-cols-1 items-center gap-[clamp(2rem,6vw,7rem)] p-[clamp(2rem,6vw,6rem)] wide:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] print:block print:p-0">
      <JobOfferAnalyzer>
        <h1 className="mt-[0.6rem] mb-[1.2rem] font-headline text-[clamp(2.8rem,6vw,5.6rem)] leading-[0.94] tracking-[-0.05em]">
          What does your job actually pay after the{" "}
          <span className="font-highlight italic">commute</span>?
        </h1>
        <p className="max-w-[480px] font-body text-[clamp(1rem,2vw,1.2rem)] leading-[1.5] text-muted">
          Plug in a job offer. Get the real monthly take-home after transport costs and travel time.
        </p>
      </JobOfferAnalyzer>
    </main>
  );
}
