import { CachedModules } from "../types/CachedModules";
import { MODULE_CACHE_PREFIX } from "./ModuleCacheKey";
import { isQuotaRefusal } from "./StorageRefusal";
import { logRecovered } from "../util/Log";

/** The part of the cache this writer needs, so a test can stand in for it. */
export type ModuleCacheStore = {
    setAsync(key: string, value: CachedModules): Promise<void>;
    clearPrefixAsync(prefix: string): Promise<number>;
};

/**
 * Writes an entry, resetting the cache and retrying once if the write is refused.
 * @param store Where the entry is written.
 * @param key The entry to write.
 * @param entry The modules found on that page.
 * @throws When the reset itself fails, which the caller's boundary catches.
 */
export const cacheModulesAsync = async (
    store: ModuleCacheStore,
    key: string,
    entry: CachedModules,
): Promise<void> => {
    try {
        await store.setAsync(key, entry);
        return;
    } catch (error) {
        const dropped = await store.clearPrefixAsync(MODULE_CACHE_PREFIX);
        if (isQuotaRefusal(error)) {
            logRecovered("session storage was full, dropped the cached files", { dropped });
        } else {
            logRecovered("caching was refused, dropped the cached files", { dropped, error });
        }
    }

    await store
        .setAsync(key, entry)
        .catch((error) => logRecovered("could not cache modules after a reset", { error }));
};
