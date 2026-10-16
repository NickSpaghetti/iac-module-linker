import { DisplayModule } from "./DisplayModule";
import { Nullable } from "./Nullable";
import { readSourcePosition } from "./SourcePosition";
import { toSourceTypeLabel } from "./SourceTypes";
import { hasField, readField, readString } from "../util/Fields";

/** A file's modules, with the commit they were read from. */
export type CachedModules = {
    readonly sha: string;
    readonly modules: DisplayModule[];
};

const readModule = (value: unknown): Nullable<DisplayModule> => {
    if (
        !hasField(value, "moduleName") ||
        typeof value.moduleName !== "string" ||
        value.moduleName === ""
    ) {
        return null;
    }
    const source = readString<DisplayModule>(value, "source") ?? "";
    return {
        source: source,
        moduleName: value.moduleName,
        sourceType: toSourceTypeLabel(readField<DisplayModule>(value, "sourceType")),
        resolvedUrl: readString<DisplayModule>(value, "resolvedUrl"),
        versionConstraint: readString<DisplayModule>(value, "versionConstraint") ?? "",
        resolvedVersion: readString<DisplayModule>(value, "resolvedVersion") ?? "",
        sourcePosition: readSourcePosition(readField<DisplayModule>(value, "sourcePosition")),
        writtenSource: readString<DisplayModule>(value, "writtenSource") ?? source,
    };
};

/**
 * Reads a list of modules, dropping each row that is not one.
 * @param value The value to read.
 * @returns The rows that are modules. Empty when value is not a list.
 */
export const readDisplayModules = (value: unknown): DisplayModule[] =>
    Array.isArray(value)
        ? value.map(readModule).filter((module): module is DisplayModule => module !== null)
        : [];

/**
 * Reads a cache entry back into the shape this build expects.
 * @param value Whatever came back from storage.
 * @returns The entry, or null when it is not one.
 */
export const readCachedModules = (value: unknown): Nullable<CachedModules> => {
    if (
        !hasField(value, "sha") ||
        typeof value.sha !== "string" ||
        !hasField(value, "modules") ||
        !Array.isArray(value.modules)
    ) {
        return null;
    }
    return { sha: value.sha, modules: readDisplayModules(value.modules) };
};
