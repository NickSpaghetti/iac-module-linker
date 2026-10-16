/** A list with at least one element. */
export type NonEmpty<T> = readonly [T, ...T[]];

/**
 * Determines whether a list has at least one element.
 * @param list The list to test.
 * @returns true if list has at least one element; otherwise, false.
 */
export const isNonEmpty = <T>(list: readonly T[]): list is NonEmpty<T> => list.length > 0;
