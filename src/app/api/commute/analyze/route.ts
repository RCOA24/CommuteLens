import { AnalyzeJobOfferUseCase } from "@/application/analyze-job-offer/use-case";
import { MockTransitProvider } from "@/providers/transit/mock-transit.provider";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ success: false, error: { code: "INVALID_INPUT", message: "Request body must be valid JSON." } }, { status: 400 }); }

  const useCase = new AnalyzeJobOfferUseCase(new MockTransitProvider());
  const result = await useCase.execute(body as never);
  return Response.json(result, { status: result.success ? 200 : result.error.code === "INVALID_INPUT" ? 400 : 422 });
}
