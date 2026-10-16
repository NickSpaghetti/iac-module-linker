import { IFetchService } from "./IFetchService";
import { readOkData, REGISTRY_NAMES } from "./RegistryResponse";
import { hasField } from "../util/Fields";
import { RegistryTarget } from "../types/RegistryTarget";
import { TERRAFORM_REGISTRY_HOST } from "../util/Constants";
import { REGISTRY_API_ROUTES, REGISTRY_CACHE_MODE } from "./RegistryApi";

const API_ROOT = `https://${TERRAFORM_REGISTRY_HOST}/v1`;

/** What the registry answers with at `/v1/{route}/{address}`. */
type VersionsResponse = { versions: string[] };

const isVersionsResponse = (data: unknown): data is VersionsResponse =>
    hasField(data, "versions") &&
    Array.isArray(data.versions) &&
    data.versions.every((version: unknown) => typeof version === "string");

/** The version list endpoint of registry.terraform.io. */
export class TerraformRegistryDataAccess {
    constructor(private readonly fetchService: IFetchService) {}

    /**
     * @param address Module or provider address ex: hashicorp/aws.
     * @param target Whether the address names a module or a provider.
     * @returns Every version the registry publishes for the address, which may be none.
     * @throws When the registry cannot be reached or answers with a non ok status.
     */
    public async getVersionsAsync(address: string, target: RegistryTarget): Promise<string[]> {
        const response = await this.fetchService.fetchDataAsync(
            `${API_ROOT}/${REGISTRY_API_ROUTES[target]}/${address}`,
            REGISTRY_CACHE_MODE,
        );
        const data = readOkData(response, REGISTRY_NAMES.TERRAFORM, address);
        return isVersionsResponse(data) ? data.versions : [];
    }
}
