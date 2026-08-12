import { AnalyzeJobOfferUseCase } from "@/application/analyze-job-offer/use-case";
import { getTransitProvider } from "@/providers/transit";
import { checkRateLimit } from "@/shared/security/rate-limit";

export async function POST(request: Request): Promise<Response> {
  const limited = checkRateLimit(request, "commute-analyze", 30);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        success: false,
        error: { code: "INVALID_INPUT", message: "Request body must be valid JSON." },
      },
      { status: 400 },
    );
  }

  const useCase = new AnalyzeJobOfferUseCase(getTransitProvider());
  const result = await useCase.execute(body);
  return Response.json(result, {
    status: result.success ? 200 : result.error.code === "INVALID_INPUT" ? 400 : 422,
  });
}
