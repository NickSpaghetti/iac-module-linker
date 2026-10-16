import { FetchRequest, ParseRequest, WORKER_QUERIES } from "./types/WorkerRequest";
import { hasField } from "./util/Fields";
import { URL_PROTOCOLS } from "./util/UrlSafety";
import { OPENTOFU_REGISTRY_HOST, TERRAFORM_REGISTRY_HOST } from "./util/Constants";

/**
 * What the service worker will fetch. Read against `host_permissions` in
 * `public/manifest.json`; the two have to agree or a lookup fails silently.
 */
export const ALLOWED_FETCH_HOSTS = [TERRAFORM_REGISTRY_HOST, OPENTOFU_REGISTRY_HOST];

const CACHE_MODES: RequestCache[] = [
    "default",
    "no-store",
    "reload",
    "no-cache",
    "force-cache",
    "only-if-cached",
];

/**
 * @param message A runtime message, of any shape.
 * @returns true if it is a well formed request to parse a file; otherwise, false.
 */
export const isParseRequest = (message: unknown): message is ParseRequest =>
    hasField(message, "contentScriptQuery") &&
    message.contentScriptQuery === WORKER_QUERIES.PARSE &&
    hasField(message, "contents") &&
    typeof message.contents === "string" &&
    hasField(message, "fileName") &&
    typeof message.fileName === "string";

/**
 * @param message A runtime message, of any shape.
 * @returns true if it is a well formed request to fetch a url; otherwise, false.
 */
export const isFetchRequest = (message: unknown): message is FetchRequest =>
    hasField(message, "contentScriptQuery") &&
    message.contentScriptQuery === WORKER_QUERIES.FETCH &&
    hasField(message, "url") &&
    typeof message.url === "string" &&
    hasField(message, "cache") &&
    isRequestCache(message.cache);

const isRequestCache = (value: unknown): value is RequestCache =>
    CACHE_MODES.some((mode) => mode === value);

/**
 * @param url The address the service worker was asked to fetch.
 * @returns true if it is https on a host this extension may reach; otherwise, false.
 */
export const isAllowedFetchHost = (url: string): boolean => {
    try {
        const parsed = new URL(url);
        return (
            parsed.protocol === URL_PROTOCOLS.HTTPS && ALLOWED_FETCH_HOSTS.includes(parsed.hostname)
        );
    } catch {
        return false;
    }
};
