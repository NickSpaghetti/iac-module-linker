import cmp from "semver/functions/cmp";
import diff from "semver/functions/diff";
import gt from "semver/functions/gt";
import parse from "semver/functions/parse";
import prerelease from "semver/functions/prerelease";
import { CLAUSE_SEPARATOR, readClause, TERRAFORM_VERSION_CONSTRAINTS } from "./ConstraintClauses";
import { fromParsed, toSemverVersion } from "./SemverVersion";
import { SemverVersion } from "../types/SemverVersion";
import { NonEmpty, isNonEmpty } from "../types/NonEmpty";
import { Nullable } from "../types/Nullable";

export { TERRAFORM_VERSION_CONSTRAINTS };

const VERSION_SEPARATOR = ".";
const VERSION_PART_COUNT = 3;

const PESSIMISTIC_OPERATOR = TERRAFORM_VERSION_CONSTRAINTS.EXACT;
const PRERELEASE_MARKERS = ["-", "+"];

type TerraformOperator =
    (typeof TERRAFORM_VERSION_CONSTRAINTS)[keyof typeof TERRAFORM_VERSION_CONSTRAINTS];

/** The operators that stand for a single comparison: every operator but `~>`. */
export type ComparisonOperator = Exclude<TerraformOperator, typeof PESSIMISTIC_OPERATOR>;

/** One comparison a satisfying version must meet. */
export type Comparator = {
    readonly operator: ComparisonOperator;
    readonly version: SemverVersion;
};

/** What a constraint can turn out to be. */
export const CONSTRAINT_OUTCOMES = {
    ANY: "any",
    BOUNDED: "bounded",
    UNRECOGNIZED: "unrecognized",
} as const;

/** A version constraint, read into the comparisons it stands for. */
export type VersionConstraint =
    | { readonly outcome: typeof CONSTRAINT_OUTCOMES.ANY }
    | {
          readonly outcome: typeof CONSTRAINT_OUTCOMES.BOUNDED;
          readonly comparators: NonEmpty<Comparator>;
      }
    | { readonly outcome: typeof CONSTRAINT_OUTCOMES.UNRECOGNIZED };

/** The constraint every release version satisfies. */
export const ANY_VERSION: VersionConstraint = { outcome: CONSTRAINT_OUTCOMES.ANY };

const UNRECOGNIZED: VersionConstraint = { outcome: CONSTRAINT_OUTCOMES.UNRECOGNIZED };

/**
 * Reads a Terraform version constraint into the comparisons it stands for.
 * `~>` is not npm's: `~> 1.2.3` is `>=1.2.3 <1.3.0`, `~> 1.2` is `>=1.2.0 <2.0.0`.
 * An npm range such as `^1.2.3` is not Terraform and comes back unrecognized
 * rather than being resolved under npm's rules.
 * @param constraint A comma separated conjunction, for example `>= 5.0, < 6.0`.
 * @returns The comparisons every satisfying version must meet.
 */
export const toVersionConstraint = (constraint: string): VersionConstraint => {
    const comparators: Comparator[] = [];

    for (const clause of constraint.split(CLAUSE_SEPARATOR)) {
        const trimmed = clause.trim();
        if (trimmed === "") {
            continue;
        }
        const bounds = toComparators(trimmed);
        if (bounds === null) {
            return UNRECOGNIZED;
        }
        comparators.push(...bounds);
    }

    return isNonEmpty(comparators)
        ? { outcome: CONSTRAINT_OUTCOMES.BOUNDED, comparators: comparators }
        : ANY_VERSION;
};

/**
 * @param version A published version.
 * @param constraint The constraint to test against.
 * @returns true if the version meets every comparison the constraint holds; otherwise, false.
 */
export const satisfies = (version: SemverVersion, constraint: VersionConstraint): boolean => {
    switch (constraint.outcome) {
        case CONSTRAINT_OUTCOMES.UNRECOGNIZED:
            return false;
        case CONSTRAINT_OUTCOMES.ANY:
            return prerelease(version) === null;
        case CONSTRAINT_OUTCOMES.BOUNDED:
            if (prerelease(version) !== null && !namesPrerelease(version, constraint.comparators)) {
                return false;
            }
            return constraint.comparators.every((comparator) =>
                cmp(version, comparator.operator, comparator.version),
            );
        default: {
            const _exhaustive: never = constraint;
            return _exhaustive;
        }
    }
};

/** Determines whether a constraint names a prerelease of the same release as a version. */
const namesPrerelease = (version: SemverVersion, comparators: NonEmpty<Comparator>): boolean =>
    comparators.some(
        (comparator) =>
            prerelease(comparator.version) !== null &&
            diff(comparator.version, version) === "prerelease",
    );

/**
 * @param versions Published versions.
 * @param constraint The constraint to resolve.
 * @returns The highest version satisfying the constraint, or null when none does.
 */
export const selectVersion = (
    versions: readonly SemverVersion[],
    constraint: VersionConstraint,
): Nullable<SemverVersion> => {
    let selected: Nullable<SemverVersion> = null;
    for (const version of versions) {
        if (satisfies(version, constraint) && (selected === null || gt(version, selected))) {
            selected = version;
        }
    }
    return selected;
};

/** Determines whether an operator is one of the plain comparisons. */
const isComparisonOperator = (operator: string): operator is ComparisonOperator =>
    operator !== PESSIMISTIC_OPERATOR &&
    Object.values(TERRAFORM_VERSION_CONSTRAINTS).some((known) => known === operator);

const toComparators = (clause: string): Nullable<NonEmpty<Comparator>> => {
    const { operator, version } = readClause(clause);
    if (operator === PESSIMISTIC_OPERATOR) {
        return toPessimisticBounds(version);
    }
    const normalized = operator === "" ? TERRAFORM_VERSION_CONSTRAINTS.EQUAL : operator;
    const parsed = parse(padVersion(version));
    if (!isComparisonOperator(normalized) || parsed === null) {
        return null;
    }
    return [{ operator: normalized, version: fromParsed(parsed) }];
};

/** Converts the version of a `~>` clause into its lower and upper bounds. */
const toPessimisticBounds = (version: string): Nullable<NonEmpty<Comparator>> => {
    const parsed = parse(padVersion(version));
    if (parsed === null) {
        return null;
    }
    const written = version.split(VERSION_SEPARATOR).length;
    const upper = toSemverVersion(
        written >= VERSION_PART_COUNT
            ? `${parsed.major}.${parsed.minor + 1}.0`
            : `${parsed.major + 1}.0.0`,
    );
    if (upper === null) {
        return null;
    }
    return [
        {
            operator: TERRAFORM_VERSION_CONSTRAINTS.GREATER_THAN_OR_EQUAL,
            version: fromParsed(parsed),
        },
        { operator: TERRAFORM_VERSION_CONSTRAINTS.LESS_THAN, version: upper },
    ];
};

/** Pads a version to three parts, so `5.0` reads as `5.0.0`. */
const padVersion = (version: string): string => {
    if (PRERELEASE_MARKERS.some((marker) => version.includes(marker))) {
        return version;
    }
    const parts = version.split(VERSION_SEPARATOR);
    while (parts.length < VERSION_PART_COUNT) {
        parts.push("0");
    }
    return parts.join(VERSION_SEPARATOR);
};
