import { describe, expect, it } from "vitest";
import type { OfferDocumentExtractionResult } from "./route";
import { POST } from "./route";

/**
 * Backboard is never reached under NODE_ENV=test, so these assert the upload
 * gate and the degraded contract: an unconfigured reader still answers 200 with
 * an empty draft, because the offer form must remain usable either way.
 */

let client = 0;

async function upload(form: FormData) {
  const request = new Request("http://localhost/api/offer-document/extract", {
    method: "POST",
    headers: { "x-forwarded-for": `10.2.0.${++client % 250}` },
    body: form,
  });
  const response = await POST(request);
  return {
    status: response.status,
    body: (await response.json()) as OfferDocumentExtractionResult,
  };
}

function file(name: string, bytes = 32, type = "application/pdf") {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("POST /api/offer-document/extract", () => {
  it("requires a file field", async () => {
    const result = await upload(new FormData());

    expect(result.status).toBe(400);
    expect(result.body.success).toBe(false);
  });

  it("rejects an empty file", async () => {
    const form = new FormData();
    form.append("file", file("offer.pdf", 0));

    expect((await upload(form)).status).toBe(400);
  });

  it("rejects a file over 2 MB", async () => {
    const form = new FormData();
    form.append("file", file("offer.pdf", 2 * 1024 * 1024 + 1));

    const result = await upload(form);
    expect(result.status).toBe(400);
    if (result.body.success) throw new Error("expected a rejection");
    expect(result.body.error.message).toContain("2 MB");
  });

  it("rejects an extension outside the allow-list, whatever type the browser claims", async () => {
    const form = new FormData();
    form.append("file", file("payload.svg", 32, "application/pdf"));

    expect((await upload(form)).status).toBe(400);
  });

  it("degrades to an empty reviewable draft when the reader is not configured", async () => {
    const form = new FormData();
    form.append("file", file("offer.pdf"));

    const result = await upload(form);
    expect(result.status).toBe(200);
    if (!result.body.success) throw new Error("expected success");

    const { extraction, officeCandidates } = result.body.data;
    expect(extraction.source).toBe("unavailable");
    expect(extraction.degradedReason).toBe("not-configured");
    expect(extraction.requiresReview).toBe(true);
    expect(extraction.fields.monthlySalary).toBeNull();
    expect(officeCandidates).toEqual([]);
  });
});
