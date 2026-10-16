import { TerraformRegistryDataAccess } from "../data-access/TerraformRegistryDataAccess";
import { Nullable } from "../types/Nullable";
import { VersionQuery } from "../types/LinkContext";
import { ANY_VERSION, selectVersion, toVersionConstraint } from "../domain/VersionConstraint";
import { semverVersionsOf } from "../domain/SemverVersion";
import { SemverVersion } from "../types/SemverVersion";

/**
 * Resolves a constraint against what registry.terraform.io publishes, falling
 * back to the newest published version when nothing satisfies it.
 */
export class TerraformVersionService {
    constructor(private readonly registry: TerraformRegistryDataAccess) {}

    /**
     * Returns the version a constraint selects from the Terraform registry.
     * @param query The address, whether it is a module or a provider, and the constraint.
     * @returns The version the constraint selects, the newest published when
     * nothing satisfies it, or null when the registry published nothing usable.
     * @throws When the registry is unreachable.
     */
    public async selectVersionAsync({
        address,
        target,
        versionConstraint,
    }: VersionQuery): Promise<Nullable<SemverVersion>> {
        const published = semverVersionsOf(await this.registry.getVersionsAsync(address, target));
        return (
            selectVersion(published, toVersionConstraint(versionConstraint)) ??
            selectVersion(published, ANY_VERSION)
        );
    }
}
