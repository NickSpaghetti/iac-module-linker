import { OpenTofuRegistryDataAccess } from "../data-access/OpenTofuRegistryDataAccess";
import { Nullable } from "../types/Nullable";
import { VersionQuery } from "../types/LinkContext";
import { selectVersion, toVersionConstraint } from "../domain/VersionConstraint";
import { semverVersionsOf } from "../domain/SemverVersion";
import { SemverVersion } from "../types/SemverVersion";

/**
 * Resolves a constraint against what registry.opentofu.org publishes, with no
 * fallback when nothing satisfies it.
 */
export class OpenTofuVersionService {
    constructor(private readonly registry: OpenTofuRegistryDataAccess) {}

    /**
     * Returns the version a constraint selects from the OpenTofu registry.
     * @param query The address, whether it is a module or a provider, and the constraint.
     * @returns The version the constraint selects, or null when nothing does.
     * @throws When the registry is unreachable.
     */
    public async selectVersionAsync({
        address,
        target,
        versionConstraint,
    }: VersionQuery): Promise<Nullable<SemverVersion>> {
        if (versionConstraint === "") {
            return null;
        }
        const published = semverVersionsOf(await this.registry.getVersionsAsync(address, target));
        return selectVersion(published, toVersionConstraint(versionConstraint));
    }
}
