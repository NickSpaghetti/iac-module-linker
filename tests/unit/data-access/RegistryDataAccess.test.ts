import { IFetchService } from "../../../src/data-access/IFetchService";
import { TerraformRegistryDataAccess } from "../../../src/data-access/TerraformRegistryDataAccess";
import { OpenTofuRegistryDataAccess } from "../../../src/data-access/OpenTofuRegistryDataAccess";
import { FETCH_OUTCOMES, RunTimeFetchResponse } from "../../../src/types/RunTimeFetchResponse";

/**
 * @param data The body the registry answered with.
 * @returns A fetch service giving that body to every url.
 */
const answering = (data: unknown): IFetchService => ({
    fetchDataAsync: () =>
        Promise.resolve<RunTimeFetchResponse>({ outcome: FETCH_OUTCOMES.OK, data: data }),
});

/**
 * @param status The error status the registry answered with.
 * @returns A fetch service rejected with that status for every url.
 */
const rejecting = (status: number): IFetchService => ({
    fetchDataAsync: () =>
        Promise.resolve<RunTimeFetchResponse>({ outcome: FETCH_OUTCOMES.REJECTED, status: status }),
});

describe("Given a registry that publishes no versions", () => {
    describe("When the Terraform registry is asked", () => {
        test("Then I expect an empty list rather than a throw", async () => {
            // Arrange
            const registry = new TerraformRegistryDataAccess(answering({ versions: [] }));

            // Act
            const versions = await registry.getVersionsAsync("hashicorp/aws", "provider");

            // Assert
            expect(versions).toEqual([]);
        });
    });

    describe("When the OpenTofu registry is asked", () => {
        test("Then I expect an empty list rather than a throw", async () => {
            // Arrange
            const registry = new OpenTofuRegistryDataAccess(answering({ modules: [] }));

            // Act
            const versions = await registry.getVersionsAsync("owner/name/aws", "module");

            // Assert
            expect(versions).toEqual([]);
        });
    });
});

describe("Given a registry that answers with a failure", () => {
    describe("When the Terraform registry is asked", () => {
        test("Then I expect a throw naming the address", async () => {
            // Arrange
            const registry = new TerraformRegistryDataAccess(rejecting(500));

            // Act
            const versions = registry.getVersionsAsync("hashicorp/aws", "provider");

            // Assert
            await expect(versions).rejects.toThrow("hashicorp/aws");
        });
    });

    describe("When the OpenTofu registry is asked", () => {
        test("Then I expect a throw naming the address", async () => {
            // Arrange
            const registry = new OpenTofuRegistryDataAccess(rejecting(500));

            // Act
            const versions = registry.getVersionsAsync("owner/name/aws", "module");

            // Assert
            await expect(versions).rejects.toThrow("owner/name/aws");
        });
    });
});

describe("Given a registry the service worker could not reach", () => {
    const unreachable: IFetchService = {
        fetchDataAsync: () =>
            Promise.resolve<RunTimeFetchResponse>({
                outcome: FETCH_OUTCOMES.FAILED,
                error: "TypeError: Failed to fetch",
            }),
    };

    describe("When the Terraform registry is asked", () => {
        test("Then I expect a throw naming the address", async () => {
            // Arrange
            const registry = new TerraformRegistryDataAccess(unreachable);

            // Act
            const versions = registry.getVersionsAsync("hashicorp/aws", "provider");

            // Assert
            await expect(versions).rejects.toThrow("hashicorp/aws");
        });
    });

    describe("When the OpenTofu registry is asked", () => {
        test("Then I expect a throw naming the address", async () => {
            // Arrange
            const registry = new OpenTofuRegistryDataAccess(unreachable);

            // Act
            const versions = registry.getVersionsAsync("owner/name/aws", "module");

            // Assert
            await expect(versions).rejects.toThrow("owner/name/aws");
        });
    });
});

describe("Given a registry that answers ok with a body of the wrong shape", () => {
    const bodies: unknown[] = [null, "<html>", 42, [], { versions: "1.0.0" }, { versions: [1, 2] }];

    describe("When the Terraform registry is asked", () => {
        test("Then I expect an empty list for each", async () => {
            // Arrange
            const registries = bodies.map(
                (body) => new TerraformRegistryDataAccess(answering(body)),
            );

            // Act
            const versions = await Promise.all(
                registries.map((registry) =>
                    registry.getVersionsAsync("hashicorp/aws", "provider"),
                ),
            );

            // Assert
            expect(versions).toEqual(bodies.map(() => []));
        });
    });

    describe("When the OpenTofu registry is asked", () => {
        test("Then I expect an empty list for each", async () => {
            // Arrange
            const shapes: unknown[] = [
                ...bodies,
                { modules: "x" },
                { modules: [{ versions: ["1.0.0"] }] },
                { versions: [{ version: 1 }] },
            ];
            const registries = shapes.map(
                (body) => new OpenTofuRegistryDataAccess(answering(body)),
            );

            // Act
            const versions = await Promise.all(
                registries.map((registry) => registry.getVersionsAsync("owner/name/aws", "module")),
            );

            // Assert
            expect(versions).toEqual(shapes.map(() => []));
        });
    });
});

describe("Given a version list with a malformed entry", () => {
    describe("When the Terraform registry is asked", () => {
        test("Then I expect an empty list", async () => {
            // Arrange
            const registry = new TerraformRegistryDataAccess(
                answering({ versions: ["1.0.0", 2, "1.1.0"] }),
            );

            // Act
            const versions = await registry.getVersionsAsync("hashicorp/aws", "provider");

            // Assert
            expect(versions).toEqual([]);
        });
    });

    describe("When the OpenTofu registry is asked for a module", () => {
        test("Then I expect an empty list", async () => {
            // Arrange
            const registry = new OpenTofuRegistryDataAccess(
                answering({
                    modules: [{ versions: [{ version: "1.0.0" }, { version: 2 }] }],
                }),
            );

            // Act
            const versions = await registry.getVersionsAsync("owner/name/aws", "module");

            // Assert
            expect(versions).toEqual([]);
        });
    });
});

describe("Given a well formed version list", () => {
    describe("When the OpenTofu registry is asked for a module", () => {
        test("Then I expect the nested list read", async () => {
            // Arrange
            const registry = new OpenTofuRegistryDataAccess(
                answering({
                    modules: [{ versions: [{ version: "1.0.0" }, { version: "1.1.0" }] }],
                }),
            );

            // Act
            const versions = await registry.getVersionsAsync("owner/name/aws", "module");

            // Assert
            expect(versions).toEqual(["1.0.0", "1.1.0"]);
        });
    });

    describe("When the OpenTofu registry is asked for a provider", () => {
        test("Then I expect the unnested list read", async () => {
            // Arrange
            const registry = new OpenTofuRegistryDataAccess(
                answering({ versions: [{ version: "5.0.0" }, { version: "5.1.0" }] }),
            );

            // Act
            const versions = await registry.getVersionsAsync("hashicorp/aws", "provider");

            // Assert
            expect(versions).toEqual(["5.0.0", "5.1.0"]);
        });
    });
});

describe("Given a registry that answers with a non ok status", () => {
    describe("When the Terraform registry is asked", () => {
        test("Then I expect the throw to name the status rather than an unreachable host", async () => {
            // Arrange
            const registry = new TerraformRegistryDataAccess(rejecting(500));

            // Act
            const versions = registry.getVersionsAsync("hashicorp/aws", "provider");

            // Assert
            await expect(versions).rejects.toThrow(
                "the terraform registry answered 500 for hashicorp/aws",
            );
        });
    });

    describe("When the OpenTofu registry is asked", () => {
        test("Then I expect the throw to name the status rather than an unreachable host", async () => {
            // Arrange
            const registry = new OpenTofuRegistryDataAccess(rejecting(500));

            // Act
            const versions = registry.getVersionsAsync("owner/name/aws", "module");

            // Assert
            await expect(versions).rejects.toThrow(
                "the opentofu registry answered 500 for owner/name/aws",
            );
        });
    });
});

describe("Given the service worker reports why it could not fetch", () => {
    const refused: IFetchService = {
        fetchDataAsync: () =>
            Promise.resolve<RunTimeFetchResponse>({
                outcome: FETCH_OUTCOMES.FAILED,
                error: "Host not allowed",
            }),
    };

    describe("When the Terraform registry is asked", () => {
        test("Then I expect the reason carried in the throw", async () => {
            // Arrange
            const registry = new TerraformRegistryDataAccess(refused);

            // Act
            const versions = registry.getVersionsAsync("hashicorp/aws", "provider");

            // Assert
            await expect(versions).rejects.toThrow(
                "could not reach the terraform registry for hashicorp/aws: Host not allowed",
            );
        });
    });

    describe("When the OpenTofu registry is asked", () => {
        test("Then I expect the reason carried in the throw", async () => {
            // Arrange
            const registry = new OpenTofuRegistryDataAccess(refused);

            // Act
            const versions = registry.getVersionsAsync("owner/name/aws", "module");

            // Assert
            await expect(versions).rejects.toThrow(
                "could not reach the opentofu registry for owner/name/aws: Host not allowed",
            );
        });
    });
});
