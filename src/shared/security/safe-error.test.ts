import { describe, expect, it } from "vitest";
import { ApiError, userFacingMessage } from "@/shared/security/safe-error";

const FALLBACK = "Explanation is unavailable.";

describe("userFacingMessage", () => {
  it("shows a message this app authored", () => {
    // The API envelope's copy is what tells someone which field was rejected,
    // so collapsing it to the fallback would lose the only useful detail.
    expect(userFacingMessage(new ApiError("Enter a monthly salary."), FALLBACK)).toBe(
      "Enter a monthly salary.",
    );
  });

  it("hides a provider error that leaks a credential", () => {
    const upstream = new Error("Incorrect API key provided: sk-proj-abc123def456. Check your key.");

    expect(userFacingMessage(upstream, FALLBACK)).toBe(FALLBACK);
  });

  it("hides a runtime error that leaks an internal path", () => {
    const crash = new TypeError("Cannot read properties of undefined (reading 'text')");

    expect(userFacingMessage(crash, FALLBACK)).toBe(FALLBACK);
  });

  it("hides a thrown string, which is not an Error at all", () => {
    expect(userFacingMessage("ECONNREFUSED 10.0.0.4:5432", FALLBACK)).toBe(FALLBACK);
  });

  it("hides a subclass of Error that is not an ApiError", () => {
    // Provider SDKs commonly subclass Error. Matching on `instanceof Error`
    // would let every one of those through.
    class OpenAiError extends Error {}

    expect(userFacingMessage(new OpenAiError("rate limit for org-9f3a"), FALLBACK)).toBe(FALLBACK);
  });

  it("keeps an ApiError distinguishable after being caught", () => {
    // The panels rely on `throw new ApiError(...)` surviving the catch, so the
    // type has to hold through a real throw rather than only at construction.
    try {
      throw new ApiError("The transit provider returned no usable route.");
    } catch (error) {
      expect(userFacingMessage(error, FALLBACK)).toBe(
        "The transit provider returned no usable route.",
      );
    }
  });
});
