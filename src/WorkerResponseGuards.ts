import { Nullable } from "./types/Nullable";
import { hasField } from "./util/Fields";
import { PARSE_OUTCOMES, ParseResponse } from "./types/ParseResponse";
import { FETCH_OUTCOMES, RunTimeFetchResponse } from "./types/RunTimeFetchResponse";

/**
 * Reads the service worker's answer to a fetch request.
 * @param message What the `sendMessage` callback received, of any shape.
 * @returns The response, or null when there was no answer or it is not one.
 */
export const readFetchResponse = (message: unknown): Nullable<RunTimeFetchResponse> => {
    if (!hasField(message, "outcome")) {
        return null;
    }
    if (message.outcome === FETCH_OUTCOMES.OK && hasField(message, "data")) {
        return { outcome: FETCH_OUTCOMES.OK, data: message.data };
    }
    if (
        message.outcome === FETCH_OUTCOMES.REJECTED &&
        hasField(message, "status") &&
        typeof message.status === "number"
    ) {
        return { outcome: FETCH_OUTCOMES.REJECTED, status: message.status };
    }
    if (
        message.outcome === FETCH_OUTCOMES.FAILED &&
        hasField(message, "error") &&
        typeof message.error === "string"
    ) {
        return { outcome: FETCH_OUTCOMES.FAILED, error: message.error };
    }
    return null;
};

/**
 * Reads the service worker's answer to a parse request.
 * @param message What the `sendMessage` callback received, of any shape.
 * @returns The response, or null when there was no answer or it is not one.
 */
export const readParseResponse = (message: unknown): Nullable<ParseResponse> => {
    if (!hasField(message, "outcome")) {
        return null;
    }
    if (
        message.outcome === PARSE_OUTCOMES.PARSED &&
        hasField(message, "declarations") &&
        message.declarations !== undefined
    ) {
        return { outcome: PARSE_OUTCOMES.PARSED, declarations: message.declarations };
    }
    if (
        message.outcome === PARSE_OUTCOMES.FAILED &&
        hasField(message, "error") &&
        typeof message.error === "string"
    ) {
        return { outcome: PARSE_OUTCOMES.FAILED, error: message.error };
    }
    return null;
};
