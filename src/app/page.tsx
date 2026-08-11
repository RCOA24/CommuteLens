import { JobOfferAnalyzer } from "@/components/job-offer/job-offer-analyzer";

export default function Home() {
  return (
    <main className="grid min-h-screen grid-cols-1 items-center gap-[clamp(2rem,6vw,7rem)] p-[clamp(2rem,6vw,6rem)] wide:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] print:block print:p-0">
      <JobOfferAnalyzer>
        <h1 className="mt-[0.6rem] mb-[1.2rem] text-[clamp(2.8rem,6vw,6.4rem)] leading-[0.94] tracking-[-0.06em]">
          Your salary says one number.
          <br />
          Your commute tells the rest.
        </h1>
        <p className="max-w-[570px] text-[clamp(1rem,2vw,1.3rem)] leading-[1.6]">
          See the money and unpaid time a job commute takes before you decide.
        </p>
      </JobOfferAnalyzer>
    </main>
  );
}
