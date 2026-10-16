const PREFIX = "[iac-module-linker]";

/** The error behind a recovered failure, and anything that identifies what failed. */
export type LogDetails = { readonly error?: unknown; readonly [context: string]: unknown };

/**
 * Writes a failure the extension recovered from to the console at the debug level.
 * @param message What could not be done.
 * @param details The error that caused it, and anything that identifies what failed.
 */
export const logRecovered = (message: string, details: LogDetails = {}): void => {
    const { error, ...context } = details;
    const parts: unknown[] = [`${PREFIX} ${message}`];
    if (Object.keys(context).length > 0) {
        parts.push(context);
    }
    if (error !== undefined) {
        parts.push(error);
    }
    console.debug(...parts);
};
