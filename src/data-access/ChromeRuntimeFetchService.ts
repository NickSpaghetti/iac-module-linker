import { IFetchService } from "./IFetchService";
import { FETCH_OUTCOMES, RunTimeFetchResponse } from "../types/RunTimeFetchResponse";
import { FetchRequest, WORKER_QUERIES } from "../types/WorkerRequest";
import { readFetchResponse } from "../WorkerResponseGuards";
import { sendToWorkerAsync, withReason, WorkerFailures } from "../services/WorkerMessage";

const FAILURES: WorkerFailures<RunTimeFetchResponse> = {
    noResponse: (reason) => ({
        outcome: FETCH_OUTCOMES.FAILED,
        error: withReason("the background script did not respond", reason),
    }),
    malformed: {
        outcome: FETCH_OUTCOMES.FAILED,
        error: "the background script answered with something that is not a fetch response",
    },
};

/** Fetches through the background script, the only context allowed to. */
export class ChromeRuntimeFetchService implements IFetchService {
    /**
     * @param url The address to fetch, checked against the manifest's hosts.
     * @param cacheMethod How the browser cache should be used.
     * @returns The response, or a failed one when the background script is gone
     * or answers with something that is not a fetch response.
     */
    async fetchDataAsync(
        url: string,
        cacheMethod: RequestCache = "default",
    ): Promise<RunTimeFetchResponse> {
        const request: FetchRequest = {
            contentScriptQuery: WORKER_QUERIES.FETCH,
            url: url,
            cache: cacheMethod,
        };
        return await sendToWorkerAsync(request, readFetchResponse, FAILURES);
    }
}
