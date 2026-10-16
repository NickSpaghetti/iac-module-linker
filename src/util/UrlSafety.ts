/** The url schemes a link or fetch may use, as `URL.protocol` spells them. */
export const URL_PROTOCOLS = {
    HTTP: "http:",
    HTTPS: "https:",
} as const;

/**
 * Determines whether an address is safe to write into an href.
 * @param url The address a link would carry.
 * @returns true if it parses and its scheme is http or https; otherwise, false.
 */
export const isSafeHttpUrl = (url: string): boolean => {
    try {
        const protocol = new URL(url).protocol;
        return protocol === URL_PROTOCOLS.HTTP || protocol === URL_PROTOCOLS.HTTPS;
    } catch {
        return false;
    }
};
