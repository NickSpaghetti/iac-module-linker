/** The word chrome uses when a storage area has no room left. */
const QUOTA_REFUSAL = "quota";

/**
 * Reports whether a rejected storage write was refused for want of room. Use
 * it to decide what to report, not whether to recover.
 * @param error Whatever the write rejected with.
 * @returns true if the message names a quota; otherwise, false.
 */
export const isQuotaRefusal = (error: unknown): boolean =>
    String(error).toLowerCase().includes(QUOTA_REFUSAL);
