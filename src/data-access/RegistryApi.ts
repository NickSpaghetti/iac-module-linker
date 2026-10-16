import { RegistryTarget } from "../types/RegistryTarget";

/** Each target's route in the registry apis. */
export const REGISTRY_API_ROUTES: Record<RegistryTarget, string> = {
    module: "modules",
    provider: "providers",
};

/** The cache mode for registry api requests. */
export const REGISTRY_CACHE_MODE: RequestCache = "force-cache";
