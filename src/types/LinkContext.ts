import { Nullable } from "./Nullable";
import { DeclarationBlock } from "./ParsedDeclaration";
import { RegistryTarget } from "./RegistryTarget";
import { SemverVersion } from "./SemverVersion";

/** What a registry is asked when a link needs a version. */
export type VersionQuery = {
    /** Module or provider address ex: terraform-aws-modules/vpc/aws. */
    readonly address: string;
    /** Whether the address names a module or a provider. */
    readonly target: RegistryTarget;
    /** The block's version constraint, or "". */
    readonly versionConstraint: string;
};

/** Resolves a version query to the version it selects, or null when there is none. */
export type VersionLookup = (query: VersionQuery) => Promise<Nullable<SemverVersion>>;

/** What a link builder needs beyond the source itself. */
export type LinkContext = {
    readonly block: DeclarationBlock;
    readonly versionConstraint: string;
    readonly pageUrl: URL;
    readonly resolveVersionAsync: VersionLookup;
    readonly resolveOpenTofuVersionAsync: VersionLookup;
};
