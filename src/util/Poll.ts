import { Nullable } from "../types/Nullable";

/**
 * Reads until something is there, or the deadline passes.
 * @param poll What to read, and how long to keep reading for.
 * @param poll.read Called until it answers with something other than null.
 * @param poll.timeoutMs How long to keep reading before giving up.
 * @param poll.pollMs How long to wait between reads.
 * @returns The first non-null answer, or null if the deadline passed first.
 */
export const pollUntilAsync = async <T>({
    read,
    timeoutMs,
    pollMs,
}: {
    read: () => Nullable<T> | Promise<Nullable<T>>;
    timeoutMs: number;
    pollMs: number;
}): Promise<Nullable<T>> => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const answer = await read();
        if (answer !== null) {
            return answer;
        }
        if (Date.now() >= deadline) {
            return null;
        }
        await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
};
