import { IFetchService } from "./IFetchService";
import { readOkData, REGISTRY_NAMES } from "./RegistryResponse";
import { hasField } from "../util/Fields";
import { RegistryTarget } from "../types/RegistryTarget";
import { OPENTOFU_REGISTRY_HOST } from "../util/Constants";
import { REGISTRY_API_ROUTES, REGISTRY_CACHE_MODE } from "./RegistryApi";

const API_ROOT = `https://${OPENTOFU_REGISTRY_HOST}/v1`;
const VERSIONS_ROUTE = "versions";

/** The version list for a provider. */
type VersionList = { versions: Array<{ version: string }> };

/** The version list for a module, nested under the matched module. */
type ModuleVersions = { modules: [VersionList, ...unknown[]] };

const isVersionList = (data: unknown): data is VersionList =>
    hasField(data, "versions") &&
    Array.isArray(data.versions) &&
    data.versions.every(
        (entry: unknown) => hasField(entry, "version") && typeof entry.version === "string",
    );

const isModuleVersions = (data: unknown): data is ModuleVersions =>
    hasField(data, "modules") && Array.isArray(data.modules) && isVersionList(data.modules[0]);

/** The version list endpoint of registry.opentofu.org. */
export class OpenTofuRegistryDataAccess {
    constructor(private readonly fetchService: IFetchService) {}

    /**
     * @param address Module or provider address ex: terraform-aws-modules/vpc/aws.
     * @param target Whether the address names a module or a provider.
     * @returns Every version the registry publishes for the address, which may be none.
     * @throws When the registry cannot be reached or answers with a non ok status.
     */
    public async getVersionsAsync(address: string, target: RegistryTarget): Promise<string[]> {
        const response = await this.fetchService.fetchDataAsync(
            `${API_ROOT}/${REGISTRY_API_ROUTES[target]}/${address}/${VERSIONS_ROUTE}`,
            REGISTRY_CACHE_MODE,
        );
        const data = readOkData(response, REGISTRY_NAMES.OPENTOFU, address);
        const list = isModuleVersions(data) ? data.modules[0] : data;
        return isVersionList(list) ? list.versions.map((entry) => entry.version) : [];
    }
}
