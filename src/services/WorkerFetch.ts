import { FetchRequest } from "../types/WorkerRequest";
import { FETCH_OUTCOMES, RunTimeFetchResponse } from "../types/RunTimeFetchResponse";
import { isAllowedFetchHost } from "../WorkerRequestGuards";

/** Why the worker refused a fetch before making it. */
export const FETCH_REFUSALS = {
    HOST_NOT_ALLOWED: "Host not allowed",
} as const;

const fetchFailed = (error: unknown): RunTimeFetchResponse => ({
    outcome: FETCH_OUTCOMES.FAILED,
    error: String(error),
});

/**
 * Makes a fetch a content script asked the service worker for.
 * @param request The url and cache mode to fetch with.
 * @param fetchAsync The fetch implementation. Defaults to the global fetch.
 * @returns The JSON body of an ok response, the status of any other, or a
 * failure when the url is not allowed, the fetch throws, or the body is not JSON.
 */
export const fetchForContentScriptAsync = async (
    request: FetchRequest,
    fetchAsync: typeof fetch = fetch,
): Promise<RunTimeFetchResponse> => {
    if (!isAllowedFetchHost(request.url)) {
        return fetchFailed(FETCH_REFUSALS.HOST_NOT_ALLOWED);
    }
    let response: Response;
    try {
        response = await fetchAsync(request.url, { cache: request.cache });
    } catch (error) {
        return fetchFailed(error);
    }
    if (!response.ok) {
        return { outcome: FETCH_OUTCOMES.REJECTED, status: response.status };
    }
    try {
        const data: unknown = await response.json();
        return { outcome: FETCH_OUTCOMES.OK, data: data };
    } catch (error) {
        return fetchFailed(error);
    }
};
