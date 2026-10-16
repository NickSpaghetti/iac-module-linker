import { MODULE_SOURCE_FLAGS, ModuleSource, hasFlag } from "../../types/ModuleSource";
import { RegistryTarget } from "../../types/RegistryTarget";
import { DECLARATION_BLOCKS, DeclarationBlock } from "../../types/ParsedDeclaration";
import { SemverVersion } from "../../types/SemverVersion";
import { PATH_SEPARATOR, lastSegment } from "../../util/PathHelpers";
import { OPENTOFU_BROWSE_HOST, TERRAFORM_REGISTRY_HOST } from "../../util/Constants";

/** The registry a source names when it names none. */
export const DEFAULT_REGISTRY_HOST = TERRAFORM_REGISTRY_HOST;
/** The version a registry route takes to mean its newest release. */
export const LATEST_VERSION = "latest";

const HASHICORP_NAMESPACE = "hashicorp";
const HASHICORP_REGISTRY_SUFFIX = ".terraform.io";
const HASHICORP_REGISTRY_HOST = "terraform.io";

/** Represents the URL layout a registry publishes its module pages at. */
export type RegistryLayout = {
    readonly browseHost: string;
    readonly routes: Record<RegistryTarget, string>;
    readonly submoduleRoute: string;
};

/** The path segment each target's browse pages sit under. Not the api's routes, which differ for OpenTofu. */
const TERRAFORM_BROWSE_ROUTES: Record<RegistryTarget, string> = {
    module: "modules",
    provider: "providers",
};
const OPENTOFU_BROWSE_ROUTES: Record<RegistryTarget, string> = {
    module: "module",
    provider: "provider",
};

/** Where registry.terraform.io publishes module and provider pages. */
export const TERRAFORM_LAYOUT: RegistryLayout = {
    browseHost: DEFAULT_REGISTRY_HOST,
    routes: TERRAFORM_BROWSE_ROUTES,
    submoduleRoute: "submodules",
};

/** Where OpenTofu publishes module and provider pages. */
export const OPENTOFU_LAYOUT: RegistryLayout = {
    // Browsed on a different host from the one its api answers on.
    browseHost: OPENTOFU_BROWSE_HOST,
    routes: OPENTOFU_BROWSE_ROUTES,
    submoduleRoute: "submodule",
};

/**
 * Determines whether the specified host is a private Terraform registry.
 * @param registryHost The registry host to test.
 * @returns true if the host is private; otherwise, false. `registry.terraform.io`
 * is public and is excluded before the suffix is considered.
 */
export const isPrivateRegistryHost = (registryHost: string): boolean => {
    if (registryHost === DEFAULT_REGISTRY_HOST) {
        return false;
    }
    return (
        registryHost === HASHICORP_REGISTRY_HOST || registryHost.endsWith(HASHICORP_REGISTRY_SUFFIX)
    );
};

/**
 * Determines what kind of address a declaration names.
 * @param block The type of block the declaration is read from.
 * @returns "provider" for a `required_providers` entry; otherwise, "module".
 */
export const registryTargetFor = (block: DeclarationBlock): RegistryTarget => {
    switch (block) {
        case DECLARATION_BLOCKS.REQUIRED_PROVIDERS:
            return "provider";
        case DECLARATION_BLOCKS.MODULE:
        case DECLARATION_BLOCKS.TERRAFORM:
            return "module";
        default: {
            const _exhaustive: never = block;
            return _exhaustive;
        }
    }
};

/**
 * Converts a source path to a registry address.
 * @param path The source path, which always carries a leading separator.
 * @returns The address with separators collapsed and no leading separator.
 */
export const registryAddress = (path: string): string =>
    path.split(PATH_SEPARATOR).filter(Boolean).join(PATH_SEPARATOR);

/**
 * Converts a source path to the address the Terraform registry knows it by.
 * @param path The source path as written.
 * @param target Whether the address names a module or a provider.
 * @returns The registry address. A bare provider name is qualified with the
 * hashicorp namespace, which the registry requires spelled out.
 */
export const normalizeRegistryAddress = (path: string, target: RegistryTarget): string => {
    const address = registryAddress(path);
    const isBareName = !address.includes(PATH_SEPARATOR);
    return isBareName && target === "provider"
        ? `${HASHICORP_NAMESPACE}${PATH_SEPARATOR}${address}`
        : address;
};

/**
 * Builds the URL of a module's page on a registry.
 * @param layout The registry the page is published on.
 * @param source The declaration, read for its subdirectory.
 * @param target Whether the address names a module or a provider.
 * @param address The address the registry knows the module by.
 * @param version The version to link to.
 * @returns The page URL, extended with the submodule route when the source
 * names a subdirectory.
 */
export const registryPageUrl = (
    layout: RegistryLayout,
    source: ModuleSource,
    target: RegistryTarget,
    address: string,
    version: SemverVersion | typeof LATEST_VERSION,
): string => {
    const base = `https://${layout.browseHost}/${layout.routes[target]}/${address}/${version}`;
    return hasFlag(source, MODULE_SOURCE_FLAGS.HasSubDirectory)
        ? `${base}/${layout.submoduleRoute}/${lastSegment(source.subDirectory)}`
        : base;
};
