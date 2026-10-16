/** The prefix on every key this cache owns. */
export const MODULE_CACHE_PREFIX = "modules:";

/**
 * Builds the storage key a page's modules are cached under.
 * @param pageUrl The page the modules were read from.
 * @returns The storage key holding that file's modules.
 */
export const moduleCacheKey = (pageUrl: string): string => {
    const url = new URL(pageUrl);
    return `${MODULE_CACHE_PREFIX}${url.hostname}:${url.pathname}`;
};
