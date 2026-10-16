/** What became of a parse the service worker was asked to make. */
export const PARSE_OUTCOMES = {
    PARSED: "parsed",
    FAILED: "failed",
} as const;

/** What the service worker answers a parse request with. */
export type ParseResponse =
    | { readonly outcome: typeof PARSE_OUTCOMES.PARSED; readonly declarations: unknown }
    | { readonly outcome: typeof PARSE_OUTCOMES.FAILED; readonly error: string };
