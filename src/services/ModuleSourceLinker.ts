import { ModuleSource } from "../types/ModuleSource";
import { OpenTofuVersionService } from "./OpenTofuVersionService";
import { TerraformVersionService } from "./TerraformVersionService";
import { NO_LINK, resolverFor } from "../domain/moduleSource/ModuleSourceResolvers";
import { LinkContext, VersionLookup } from "../types/LinkContext";
import { ModuleLink } from "../types/ModuleLink";
import { DeclarationBlock } from "../types/ParsedDeclaration";
import { logRecovered } from "../util/Log";

/** Builds the browse url for a classified module source, from the shared resolver table. */
export class ModuleSourceLinker {
    constructor(
        private readonly terraformVersionService: TerraformVersionService,
        private readonly openTofuVersionService: OpenTofuVersionService,
    ) {}

    /**
     * Builds the browse link for a classified module source.
     *
     * A defect in a pure link builder is not caught here. It should surface.
     * @param source A classified module source.
     * @param block The type of block the source is declared in.
     * @param versionConstraint The block's version constraint, or "".
     * @param pageUrl The page the source was read from, for relative paths.
     * @returns The browse url and the version a registry resolved, if any.
     */
    public async linkAsync(
        source: ModuleSource,
        block: DeclarationBlock,
        versionConstraint: string,
        pageUrl: URL,
    ): Promise<ModuleLink> {
        const build = resolverFor(source).linkAsync;
        if (build === null) {
            return NO_LINK;
        }
        return await build(source, this.contextFor(block, versionConstraint, pageUrl));
    }

    private contextFor(
        block: DeclarationBlock,
        versionConstraint: string,
        pageUrl: URL,
    ): LinkContext {
        return {
            block: block,
            versionConstraint: versionConstraint,
            pageUrl: pageUrl,
            resolveVersionAsync: contained((query) =>
                this.terraformVersionService.selectVersionAsync(query),
            ),
            resolveOpenTofuVersionAsync: contained((query) =>
                this.openTofuVersionService.selectVersionAsync(query),
            ),
        };
    }
}

/** Wraps a version lookup so a registry that fails reads as one that names no version. */
const contained =
    (lookup: VersionLookup): VersionLookup =>
    async (query) => {
        try {
            return await lookup(query);
        } catch (error) {
            logRecovered("could not resolve a version", { address: query.address, error });
            return null;
        }
    };
