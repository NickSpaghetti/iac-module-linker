import { Nullable } from "./Nullable";
import { hasField } from "../util/Fields";

/** Where a module source is written. */
export type SourcePosition = {
    /** The 1-based line the source is written on. */
    readonly line: number;
    /** The 0-based UTF-16 offset of the written source within its line. */
    readonly column: number;
};

/**
 * Reads the position a value carries.
 * @param value The object to read.
 * @returns Its line and column, or null unless both are numbers.
 */
export const readSourcePosition = (value: unknown): Nullable<SourcePosition> =>
    hasField(value, "line") &&
    typeof value.line === "number" &&
    hasField(value, "column") &&
    typeof value.column === "number"
        ? { line: value.line, column: value.column }
        : null;
