import { CompareJobOffersUseCase } from "@/application/compare-job-offers/use-case";
import { MockTransitProvider } from "@/providers/transit/mock-transit.provider";

export async function POST(request: Request): Promise<Response> {
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

  const result = await new CompareJobOffersUseCase(new MockTransitProvider()).execute(body);
  return Response.json(result, {
    status: result.success ? 200 : result.error.code === "INVALID_INPUT" ? 400 : 422,
  });
}
