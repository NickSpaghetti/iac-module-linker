/** What became of a fetch the service worker was asked to make. */
export const FETCH_OUTCOMES = {
    OK: "ok",
    REJECTED: "rejected",
    FAILED: "failed",
} as const;

/** What the service worker answers a fetch request with. */
export type RunTimeFetchResponse =
    | { readonly outcome: typeof FETCH_OUTCOMES.OK; readonly data: unknown }
    | { readonly outcome: typeof FETCH_OUTCOMES.REJECTED; readonly status: number }
    | { readonly outcome: typeof FETCH_OUTCOMES.FAILED; readonly error: string };
