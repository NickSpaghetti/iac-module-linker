/** Generic path handling: no domain knowledge, no I/O. */
export const PATH_SEPARATOR = "/";

/**
 * @param path A path, with or without a trailing separator.
 * @returns The last non-empty segment, or "" when there is none.
 */
export const lastSegment = (path: string): string =>
    path.split(PATH_SEPARATOR).filter(Boolean).pop() ?? "";

/**
 * Determines whether a path names a file, by a dot in its final segment.
 * @param path A path to classify.
 * @returns true if it names a file; otherwise, false.
 */
export const isFilePath = (path: string): boolean => lastSegment(path).includes(".");
