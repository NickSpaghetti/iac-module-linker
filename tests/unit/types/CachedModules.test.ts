import { expect } from "@jest/globals";
import { readCachedModules } from "../../../src/types/CachedModules";
import { SourceTypes } from "../../../src/types/SourceTypes";

/**
 * Builds a cache entry around a set of rows.
 * @param modules The rows the entry holds, in whatever shape the case needs.
 * @returns An entry shaped the way storage returns one.
 */
const entry = (modules: unknown[]) => ({
    sha: "49e180c0",
    modules,
});

/** A row exactly as this build writes one. */
const row = {
    source: "terraform-aws-modules/vpc/aws",
    moduleName: "vpc",
    sourceType: "registry",
    resolvedUrl: "https://registry.terraform.io/x",
    versionConstraint: "~> 6.0",
    resolvedVersion: "6.7.3",
    sourcePosition: { line: 12, column: 14 },
    writtenSource: "terraform-aws-modules/vpc/aws",
};

describe("Given a cache entry read back from storage", () => {
    describe("When it was written by this build", () => {
        test("Then I expect it unchanged", () => {
            // Arrange
            const stored = entry([row]);

            // Act
            const read = readCachedModules(stored);

            // Assert
            expect(read?.sha).toBe("49e180c0");
            expect(read?.modules[0]).toEqual({ ...row, sourceType: SourceTypes.registry });
        });
    });

    describe("When a source type is one this build no longer has", () => {
        test("Then I expect it read as unknown rather than shown as itself", () => {
            // Arrange
            // `git` and `ssh` were the spelling before `git:https` and `git:ssh`.
            const stored = entry([{ ...row, sourceType: "git" }]);

            // Act
            const read = readCachedModules(stored);

            // Assert
            expect(read?.modules[0].sourceType).toBe(SourceTypes.unknown);
        });
    });

    describe("When a row is missing the name that identifies it", () => {
        test("Then I expect that row dropped and the rest kept", () => {
            // Arrange
            const stored = entry([{ ...row, moduleName: "" }, row]);

            // Act
            const read = readCachedModules(stored);

            // Assert
            expect(read?.modules).toHaveLength(1);
            expect(read?.modules[0].moduleName).toBe("vpc");
        });
    });

    describe("When a row is missing everything but its name", () => {
        test("Then I expect the other fields to fall back", () => {
            // Arrange
            const stored = entry([{ moduleName: "bare" }]);

            // Act
            const read = readCachedModules(stored);

            // Assert
            expect(read?.modules[0]).toEqual({
                source: "",
                moduleName: "bare",
                sourceType: SourceTypes.unknown,
                resolvedUrl: null,
                versionConstraint: "",
                resolvedVersion: "",
                sourcePosition: null,
                writtenSource: "",
            });
        });
    });

    describe("When a row has no written source", () => {
        test("Then I expect its source used", () => {
            // Arrange
            const { writtenSource: _, ...older } = row;
            const stored = entry([older]);

            // Act
            const read = readCachedModules(stored);

            // Assert
            expect(read?.modules[0].writtenSource).toBe(row.source);
        });
    });

    describe("When a row has a source position", () => {
        test("Then I expect the position kept", () => {
            // Arrange
            const stored = entry([row]);

            // Act
            const read = readCachedModules(stored);

            // Assert
            expect(read?.modules[0].sourcePosition).toEqual({ line: 12, column: 14 });
        });
    });

    describe("When a row's source position is not one", () => {
        test("Then I expect it read as null", () => {
            // Arrange
            // The last row keeps line and column as flat fields, outside a position.
            const positions: unknown[] = [{ line: "12", column: 14 }, { line: 12 }, null];
            const stored = entry([
                ...positions.map((sourcePosition) => ({ ...row, sourcePosition })),
                { ...row, sourcePosition: undefined, sourceLine: 12, sourceColumn: 14 },
            ]);

            // Act
            const read = readCachedModules(stored);

            // Assert
            expect(read?.modules.map((module) => module.sourcePosition)).toEqual([
                null,
                null,
                null,
                null,
            ]);
        });
    });

    describe("When the entry is not one", () => {
        test("Then I expect null", () => {
            // Arrange
            const stored = [
                null,
                undefined,
                "MODULES",
                [row],
                { modules: [row] },
                { sha: "x", modules: "not an array" },
            ];

            // Act
            const read = stored.map(readCachedModules);

            // Assert
            expect(read).toEqual(stored.map(() => null));
        });
    });
});
