/** The kinds of module source the popup labels. */
export enum SourceTypes {
    url = "url",
    path = "path",
    registry = "registry",
    privateRegistry = "privateRegistry",
    gitHttps = "git:https",
    gitHttp = "git:http",
    gitSsh = "git:ssh",
    gitFtp = "git:ftp",
    gitFtps = "git:ftps",
    gitDaemon = "git:git",
    mercurialHttps = "mercurial:https",
    mercurialHttp = "mercurial:http",
    mercurialSsh = "mercurial:ssh",
    oci = "oci",
    archive = "archive",
    unknown = "unknown",
}

/**
 * @param value A source type read back from storage, written by any build.
 * @returns The value when it is a member of this enum, otherwise unknown.
 */
export const toSourceTypeLabel = (value: unknown): SourceTypes =>
    Object.values(SourceTypes).find((member) => member === value) ?? SourceTypes.unknown;
