import SemVer from "semver/classes/semver";
import valid from "semver/functions/valid";
import { Nullable } from "../types/Nullable";
import { SemverVersion } from "../types/SemverVersion";

/**
 * Reads a version string semver accepts.
 * @param value A version as written.
 * @returns The same string, or null when semver cannot read it.
 */
export const toSemverVersion = (value: string): Nullable<SemverVersion> =>
    valid(value) === null ? null : (value as SemverVersion);

/**
 * Keeps the versions semver accepts.
 * @param values The versions a registry publishes.
 * @returns The ones semver can read, in the same order.
 */
export const semverVersionsOf = (values: readonly string[]): SemverVersion[] =>
    values
        .map((value) => toSemverVersion(value))
        .filter((version): version is SemverVersion => version !== null);

/**
 * Reads the version string of a parsed version.
 * @param parsed A version semver has already parsed.
 * @returns Its version string.
 */
export const fromParsed = (parsed: SemVer): SemverVersion => parsed.version as SemverVersion;
