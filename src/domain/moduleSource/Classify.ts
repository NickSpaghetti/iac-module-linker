import { ModuleSource } from "../../types/ModuleSource";
import { resolverFor } from "./ModuleSourceResolvers";

/**
 * Sets the popup label from the resolver table the linker builds from.
 * @param source A module source that has been through detect.
 * @returns The same source with `sourceType` set.
 */
export const classify = (source: ModuleSource): ModuleSource => {
    source.sourceType = resolverFor(source).label(source);
    return source;
};
