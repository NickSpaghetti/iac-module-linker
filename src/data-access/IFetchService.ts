import { RunTimeFetchResponse } from "../types/RunTimeFetchResponse";

/** Fetches JSON from a registry. */
export interface IFetchService {
    /**
     * Fetches a url and reads its body as JSON.
     * @param url The address to fetch.
     * @param cacheMethod The cache mode to fetch with.
     * @returns The status and body, or a failure when there is no usable reply.
     */
    fetchDataAsync(url: string, cacheMethod: RequestCache): Promise<RunTimeFetchResponse>;
}
