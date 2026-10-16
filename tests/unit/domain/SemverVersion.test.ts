import { expect } from "@jest/globals";
import { semverVersionsOf, toSemverVersion } from "../../../src/domain/SemverVersion";
import { Nullable } from "../../../src/types/Nullable";

describe("Given a version a registry publishes", () => {
    describe("When semver can read it", () => {
        test("Then I expect the same string back, spelling kept", () => {
            // Arrange
            const versions = ["1.2.3", "v1.2.0", "6.0.0-beta1"];

            // Act
            const read = versions.map(toSemverVersion);

            // Assert
            expect<Nullable<string>[]>(read).toEqual(versions);
        });
    });

    describe("When semver cannot read it", () => {
        test("Then I expect null", () => {
            // Arrange
            const values = ["latest", "1.0", "", "banana"];

            // Act
            const read = values.map(toSemverVersion);

            // Assert
            expect<Nullable<string>[]>(read).toEqual(values.map(() => null));
        });
    });
});

describe("Given the versions a registry publishes", () => {
    describe("When some are not versions", () => {
        test("Then I expect only the versions kept, in order", () => {
            // Act
            const versions = semverVersionsOf(["1.0.0", "latest", "v2.0.0", "1.0", "3.0.0"]);

            // Assert
            expect<string[]>(versions).toEqual(["1.0.0", "v2.0.0", "3.0.0"]);
        });
    });
});
