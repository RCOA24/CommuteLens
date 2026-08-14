/**
 * CL-015 — keeps provider and runtime detail out of user-facing error copy.
 *
 * The API envelope's `error.message` is written by this app and is safe to show:
 * it is what tells someone which field was rejected. A caught exception is not.
 * Network failures, JSON parse errors, and provider SDK errors all arrive as
 * `Error` and can carry an API key fragment, an organisation id, an internal
 * hostname, or a stack. Rendering `error.message` from a `catch` puts whichever
 * of those occurred into the DOM.
 *
 * The two are told apart by type rather than by inspecting the string, because
 * pattern-matching error text is guesswork that fails open.
 */

/** An error whose message this app authored, and which is safe to display. */
export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Copy that is safe to render for a caught error.
 *
 * @param error caught value of unknown type
 * @param fallback app-authored copy used for anything not an ApiError
 * @returns the ApiError's message, otherwise the fallback
 */
export function userFacingMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
