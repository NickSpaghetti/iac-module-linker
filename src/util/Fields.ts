import { Nullable } from "../types/Nullable";

/**
 * Determines whether a value is an object with a given field.
 * @param value The value to test.
 * @param key The field to look for.
 * @returns true if value is an object with key; otherwise, false.
 */
export const hasField = <K extends string>(value: unknown, key: K): value is Record<K, unknown> =>
    typeof value === "object" && value !== null && key in value;

/**
 * Reads a field from a value that may have the shape T.
 * @param value The value to read.
 * @param key The field to read, one T has.
 * @returns The field, or undefined when value has no such field.
 */
export const readField = <T>(value: unknown, key: NoInfer<keyof T> & string): unknown =>
    hasField(value, key) ? value[key] : undefined;

/**
 * Reads a string field from a value that may have the shape T.
 * @param value The value to read.
 * @param key The field to read, one T has.
 * @returns The field, or null when value has no such field or it is not a string.
 */
export const readString = <T>(value: unknown, key: NoInfer<keyof T> & string): Nullable<string> => {
    const field = readField<T>(value, key);
    return typeof field === "string" ? field : null;
};
