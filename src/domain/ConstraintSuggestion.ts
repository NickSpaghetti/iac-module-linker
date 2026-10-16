import { Nullable } from "../types/Nullable";
import { CLAUSE_SEPARATOR, readClause, TERRAFORM_VERSION_CONSTRAINTS } from "./ConstraintClauses";

const VERSION_SEPARATOR = ".";
const DIGITS = "0123456789";
const PRERELEASE_MARKERS = ["-", "+"];

const isDigits = (text: string): boolean =>
    text !== "" && [...text].every((character) => DIGITS.includes(character));

/** The leading digits of a part, so `0-beta1` compares as 0. */
const numericHead = (part: string): number => {
    let end = 0;
    while (end < part.length && DIGITS.includes(part[end])) {
        end += 1;
    }
    return end === 0 ? 0 : Number(part.slice(0, end));
};

/**
 * Determines whether one version is above another, comparing part by part.
 * @param candidate The version being suggested.
 * @param pinned The version the constraint already names.
 * @returns true if candidate is above pinned; otherwise, false.
 */
const isAbove = (candidate: string, pinned: string): boolean => {
    const left = candidate.split(VERSION_SEPARATOR);
    const right = pinned.split(VERSION_SEPARATOR);
    const depth = Math.max(left.length, right.length);
    for (let part = 0; part < depth; part += 1) {
        const a = numericHead(left[part] ?? "0");
        const b = numericHead(right[part] ?? "0");
        if (a !== b) {
            return a > b;
        }
    }
    return false;
};

/** The operators whose version can be raised toward the newest release. */
const BUMPABLE: readonly string[] = [
    "",
    TERRAFORM_VERSION_CONSTRAINTS.EXACT,
    TERRAFORM_VERSION_CONSTRAINTS.EQUAL,
    TERRAFORM_VERSION_CONSTRAINTS.GREATER_THAN_OR_EQUAL,
];

/** Every part is digits. The last may carry a prerelease, as `6.8.0-beta1` does. */
const isVersion = (text: string): boolean => {
    const parts = text.split(VERSION_SEPARATOR);
    return parts.every((part, index) => {
        if (isDigits(part)) {
            return true;
        }
        if (index !== parts.length - 1) {
            return false;
        }
        return PRERELEASE_MARKERS.some((marker) => {
            const at = part.indexOf(marker);
            return at > 0 && isDigits(part.slice(0, at));
        });
    });
};

/**
 * Returns a constraint pinned to what this one currently resolves to, at the
 * same precision: `~> 6.0` against 6.7.3 suggests `~> 6.7`. A constraint of
 * several clauses gets no suggestion.
 * @param pin The constraint and what it resolved to.
 * @param pin.constraint The constraint as the author wrote it.
 * @param pin.resolvedVersion The version the registry says that constraint selects.
 * @returns The constraint to write instead, or null when there is nothing to say.
 */
export const suggestConstraint = ({
    constraint,
    resolvedVersion,
}: {
    constraint: string;
    resolvedVersion: string;
}): Nullable<string> => {
    if (constraint === "" || resolvedVersion === "") {
        return null;
    }
    if (constraint.includes(CLAUSE_SEPARATOR)) {
        return null;
    }

    const { operator, version } = readClause(constraint.trim());
    if (!BUMPABLE.includes(operator) || !isVersion(version) || !isVersion(resolvedVersion)) {
        return null;
    }

    const pinned = version.split(VERSION_SEPARATOR).length;
    const suggested = resolvedVersion
        .split(VERSION_SEPARATOR)
        .slice(0, pinned)
        .join(VERSION_SEPARATOR);
    if (!isAbove(suggested, version)) {
        return null;
    }
    return operator === "" ? suggested : `${operator} ${suggested}`;
};
