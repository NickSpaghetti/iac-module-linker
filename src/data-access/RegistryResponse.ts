import { FETCH_OUTCOMES, RunTimeFetchResponse } from "../types/RunTimeFetchResponse";

/** The registry names used in error messages. */
export const REGISTRY_NAMES = {
    TERRAFORM: "terraform",
    OPENTOFU: "opentofu",
} as const;

type RegistryName = (typeof REGISTRY_NAMES)[keyof typeof REGISTRY_NAMES];

/**
 * Reads the body of a registry's answer, or throws saying why there is none.
 * @param response What the service worker answered the fetch with.
 * @param registry The registry that was asked.
 * @param address The module or provider address that was asked for.
 * @returns The body of an ok answer, of any shape.
 * @throws When the registry could not be reached, or answered with a non ok status.
 */
export const readOkData = (
    response: RunTimeFetchResponse,
    registry: RegistryName,
    address: string,
): unknown => {
    switch (response.outcome) {
        case FETCH_OUTCOMES.OK:
            return response.data;
        case FETCH_OUTCOMES.REJECTED:
            throw new Error(`the ${registry} registry answered ${response.status} for ${address}`);
        case FETCH_OUTCOMES.FAILED:
            throw new Error(
                `could not reach the ${registry} registry for ${address}: ${response.error}`,
            );
        default: {
            const _exhaustive: never = response;
            return _exhaustive;
        }
    }
};
