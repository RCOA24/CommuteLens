/**
 * Provider-level failure. Carries a safe, user-facing message only.
 *
 * The upstream response body, request URL, and any credentials are deliberately
 * not attached: this error is allowed to cross into the API layer and be logged.
 */
export class GeocodingProviderError extends Error {
  constructor(
    message: string,
    readonly reason: "timeout" | "upstream" | "malformed" | "rejected",
  ) {
    super(message);
    this.name = "GeocodingProviderError";
  }
}
