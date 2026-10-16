import { MODULE_SOURCE_FLAGS, ModuleSource, hasFlag } from "../../types/ModuleSource";
import { SourceTypes } from "../../types/SourceTypes";
import { Nullable } from "../../types/Nullable";
import { LinkContext } from "../../types/LinkContext";
import { ModuleLink } from "../../types/ModuleLink";
import { BROWSE_LAYOUTS, browseRoute } from "./RepositoryHosts";
import {
    DEFAULT_REGISTRY_HOST,
    LATEST_VERSION,
    OPENTOFU_LAYOUT,
    TERRAFORM_LAYOUT,
    isPrivateRegistryHost,
    normalizeRegistryAddress,
    registryAddress,
    registryPageUrl,
    registryTargetFor,
} from "./RegistryHosts";
import { PATH_SEPARATOR } from "../../util/PathHelpers";
import { OPENTOFU_REGISTRY_HOST } from "../../util/Constants";
import { isSafeHttpUrl } from "../../util/UrlSafety";

const GIT_SUFFIX = ".git";

type LinkBuilder = (source: ModuleSource, context: LinkContext) => Promise<ModuleLink>;

/** A link with no resolved version. */
const linkOnly = (url: Nullable<string>): ModuleLink => ({ url: url, resolvedVersion: "" });

/** The link for a source with nowhere to browse to. */
export const NO_LINK: ModuleLink = { url: null, resolvedVersion: "" };

/** Builds a browse link from a source that carries its own address. */
const linkHttpLocator = (source: ModuleSource): ModuleLink => {
    if (!hasFlag(source, MODULE_SOURCE_FLAGS.HttpTransport)) {
        return NO_LINK;
    }
    return linkOnly(
        isSafeHttpUrl(source.locator) ? source.locator : `https://${source.host}${source.path}`,
    );
};

/** A row of the resolver table: which sources it takes, and how it labels and links them. */
export type ModuleSourceResolver = {
    /** The row's name. */
    readonly name: string;
    /** Determines whether this row decides the source. */
    readonly matches: (source: ModuleSource) => boolean;
    /** The source's label in the popup. */
    readonly label: (source: ModuleSource) => SourceTypes;
    /** Builds the source's link, or null when there is no browsable address. */
    readonly linkAsync: Nullable<LinkBuilder>;
};

/** The protocols mercurial can fetch over. */
const MERCURIAL_LABELS: Record<string, SourceTypes | undefined> = {
    https: SourceTypes.mercurialHttps,
    http: SourceTypes.mercurialHttp,
    ssh: SourceTypes.mercurialSsh,
};

/** The protocols git can fetch over. */
const GIT_LABELS: Record<string, SourceTypes | undefined> = {
    https: SourceTypes.gitHttps,
    http: SourceTypes.gitHttp,
    ssh: SourceTypes.gitSsh,
    ftp: SourceTypes.gitFtp,
    ftps: SourceTypes.gitFtps,
    git: SourceTypes.gitDaemon,
};

const mercurialLabel = (source: ModuleSource): SourceTypes =>
    MERCURIAL_LABELS[source.scheme] ?? SourceTypes.unknown;

const gitLabel = (source: ModuleSource): SourceTypes =>
    GIT_LABELS[source.scheme] ?? SourceTypes.unknown;

const flagged =
    (flag: number) =>
    (source: ModuleSource): boolean =>
        hasFlag(source, flag);

/** The flags that each mean a source addresses a repository. */
const REPOSITORY_FLAGS =
    MODULE_SOURCE_FLAGS.SshTransport |
    MODULE_SOURCE_FLAGS.SchemelessAddress |
    MODULE_SOURCE_FLAGS.RepositoryAddress;

/** Matches a source that has any of the flags. */
const anyFlag =
    (flags: number) =>
    (source: ModuleSource): boolean =>
        (source.flags & flags) !== 0;

/**
 * Ordered. The first row whose `matches` holds decides both the label and the
 * link, so the two can never disagree about what a source is.
 */
const MODULE_SOURCE_RESOLVERS: readonly ModuleSourceResolver[] = [
    {
        // First, so a rejected source is never matched by another row.
        name: "unsupported",
        matches: flagged(MODULE_SOURCE_FLAGS.Unsupported),
        label: () => SourceTypes.unknown,
        linkAsync: null,
    },
    {
        name: "localPath",
        matches: flagged(MODULE_SOURCE_FLAGS.LocalPath),
        label: () => SourceTypes.path,
        linkAsync: (source, context) =>
            Promise.resolve(linkOnly(linkLocalPath(source, context.pageUrl))),
    },
    {
        name: "ociArtifact",
        matches: flagged(MODULE_SOURCE_FLAGS.OciArtifact),
        label: () => SourceTypes.oci,
        linkAsync: null,
    },
    {
        name: "mercurial",
        matches: flagged(MODULE_SOURCE_FLAGS.MercurialRepo),
        label: mercurialLabel,
        linkAsync: (source) => Promise.resolve(linkHttpLocator(source)),
    },
    {
        name: "archive",
        matches: flagged(MODULE_SOURCE_FLAGS.Archive),
        label: () => SourceTypes.archive,
        linkAsync: (source) => Promise.resolve(linkHttpLocator(source)),
    },
    {
        name: "privateRegistry",
        matches: (source) =>
            hasFlag(source, MODULE_SOURCE_FLAGS.RegistryAddress) &&
            isPrivateRegistryHost(source.registryHost),
        label: () => SourceTypes.privateRegistry,
        linkAsync: (source) =>
            Promise.resolve(linkOnly(`https://${source.registryHost}${source.path}`)),
    },
    {
        name: "registry",
        matches: flagged(MODULE_SOURCE_FLAGS.RegistryAddress),
        label: () => SourceTypes.registry,
        linkAsync: linkRegistryAsync,
    },
    {
        name: "repository",
        matches: anyFlag(REPOSITORY_FLAGS),
        label: gitLabel,
        linkAsync: (source) => Promise.resolve(linkOnly(linkRepository(source))),
    },
    {
        name: "httpAddress",
        matches: flagged(MODULE_SOURCE_FLAGS.HttpTransport),
        label: () => SourceTypes.url,
        linkAsync: (source) => Promise.resolve(linkHttpLocator(source)),
    },
];

const FALLBACK_RESOLVER: ModuleSourceResolver = {
    name: "unknown",
    matches: () => true,
    label: () => SourceTypes.unknown,
    linkAsync: null,
};

/**
 * Returns the resolver that decides a source's label and link.
 *
 * The first resolver whose `matches` holds, or a fallback that labels the
 * source unknown and offers no link.
 * @param source A module source that has been through detect.
 * @returns The resolver deciding this source's label and link.
 */
export const resolverFor = (source: ModuleSource): ModuleSourceResolver =>
    MODULE_SOURCE_RESOLVERS.find((resolver) => resolver.matches(source)) ?? FALLBACK_RESOLVER;

const linkLocalPath = (source: ModuleSource, pageUrl: URL): Nullable<string> => {
    const resolved = new URL(source.path, pageUrl.href);
    const host = BROWSE_LAYOUTS[pageUrl.hostname];
    if (host === undefined) {
        return resolved.href;
    }
    const replacement = routeMarker(browseRoute(host, resolved.pathname));

    // The route follows the owner and the repository, either of which can be
    // named like one, so the search starts after them.
    const from = afterOwnerAndRepository(resolved.pathname);
    const found = [host.fileRoute, host.directoryRoute]
        .map(routeMarker)
        .map((marker) => ({ marker, at: resolved.pathname.indexOf(marker, from) }))
        .filter(({ at }) => at !== -1)
        .sort((a, b) => a.at - b.at)[0];
    if (found === undefined) {
        return resolved.href;
    }
    const pathname =
        resolved.pathname.slice(0, found.at) +
        replacement +
        resolved.pathname.slice(found.at + found.marker.length);
    return `${resolved.origin}${pathname}`;
};

const afterOwnerAndRepository = (pathname: string): number => {
    const ownerEnd = pathname.indexOf(PATH_SEPARATOR, 1);
    const repositoryEnd = ownerEnd === -1 ? -1 : pathname.indexOf(PATH_SEPARATOR, ownerEnd + 1);
    return repositoryEnd === -1 ? pathname.length : repositoryEnd;
};

const routeMarker = (route: string): string => `${PATH_SEPARATOR}${route}${PATH_SEPARATOR}`;

/**
 * The ref that means "whatever the default branch is". Every host resolves it,
 * and it is the only safe choice: guessing `main` 404s on a `master`
 * repository, which is most of the older ones.
 */
const DEFAULT_REFERENCE = "HEAD";

const linkRepository = (source: ModuleSource): Nullable<string> => {
    const repository = stripGitSuffix(source.path);
    const root = `https://${source.host}${repository}`;

    if (source.ref === "" && source.subDirectory === "") {
        return root;
    }

    const host = BROWSE_LAYOUTS[source.host];
    if (host === undefined) {
        return root;
    }

    const reference = source.ref === "" ? DEFAULT_REFERENCE : source.ref;
    return joinPath(root, browseRoute(host, source.subDirectory), reference, source.subDirectory);
};

/** Drops empty segments, so a ref with no subdir does not trail a separator. */
const joinPath = (base: string, ...segments: string[]): string =>
    [base, ...segments.filter((segment) => segment !== "")].join(PATH_SEPARATOR);

const stripGitSuffix = (path: string): string =>
    path.endsWith(GIT_SUFFIX) ? path.slice(0, -GIT_SUFFIX.length) : path;

async function linkRegistryAsync(source: ModuleSource, context: LinkContext): Promise<ModuleLink> {
    if (source.registryHost === OPENTOFU_REGISTRY_HOST) {
        return await linkOpenTofuRegistryAsync(source, context);
    }

    if (source.registryHost !== "" && source.registryHost !== DEFAULT_REGISTRY_HOST) {
        return linkOnly(`https://${source.registryHost}${source.path}`);
    }

    const target = registryTargetFor(context.block);

    const address = normalizeRegistryAddress(source.path, target);
    const version = await context.resolveVersionAsync({
        address,
        target,
        versionConstraint: context.versionConstraint,
    });
    if (version === null) {
        return NO_LINK;
    }

    return {
        url: registryPageUrl(TERRAFORM_LAYOUT, source, target, address, version),
        resolvedVersion: version,
    };
}

// OpenTofu's pages take a version, not a constraint; `latest` is always a live page.
async function linkOpenTofuRegistryAsync(
    source: ModuleSource,
    context: LinkContext,
): Promise<ModuleLink> {
    const target = registryTargetFor(context.block);
    const address = registryAddress(source.path);

    const published = await context.resolveOpenTofuVersionAsync({
        address,
        target,
        versionConstraint: context.versionConstraint,
    });
    const version = published ?? LATEST_VERSION;

    return {
        url: registryPageUrl(OPENTOFU_LAYOUT, source, target, address, version),
        resolvedVersion: published ?? "",
    };
}
