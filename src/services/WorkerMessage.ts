import { Nullable } from "../types/Nullable";
import { WorkerRequest } from "../types/WorkerRequest";

/** The responses a caller reads when the service worker gives no usable answer. */
export type WorkerFailures<T> = {
    /** Returned when the worker gives no answer, with the reason Chrome reports. */
    readonly noResponse: (reason?: string) => T;
    /** Returned when read rejects the answer. */
    readonly malformed: T;
};

/**
 * Appends a reason to a failure message.
 * @param message The failure message.
 * @param reason The reason, if there is one.
 * @returns The message, followed by the reason when there is one.
 */
export const withReason = (message: string, reason?: string): string =>
    reason === undefined ? message : `${message}: ${reason}`;

/**
 * Sends a request to the service worker and reads its answer.
 * @param request The request to send.
 * @param read Reads the answer, or returns null when it is not a response.
 * @param failures The responses to return when there is no usable answer.
 * @returns The answer read into a response, or one of failures.
 */
export const sendToWorkerAsync = async <T>(
    request: WorkerRequest,
    read: (answer: unknown) => Nullable<T>,
    failures: WorkerFailures<T>,
): Promise<T> =>
    await new Promise((resolve) => {
        chrome.runtime.sendMessage(request, (answer: unknown) => {
            // Chrome calls back with no answer and sets lastError when the worker
            // goes away mid request. Reading lastError also marks it handled.
            const lastError = chrome.runtime.lastError;
            if (answer === undefined) {
                resolve(failures.noResponse(lastError?.message));
                return;
            }
            resolve(read(answer) ?? failures.malformed);
        });
    });
