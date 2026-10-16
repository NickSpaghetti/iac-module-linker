import { expect } from "@jest/globals";
import { readModuleDeclarations } from "../../../src/domain/ModuleDeclarationReader";
import { TerraformModule } from "../../../src/types/Terraform";
import { DECLARATION_BLOCKS } from "../../../src/types/ParsedDeclaration";

describe("Given declarations from the parser", () => {
    describe("When each has every field", () => {
        test("Then I expect them read in order", () => {
            // Arrange
            const emitted = [
                {
                    name: "vpc",
                    block: "module",
                    source: "a/b/c",
                    written: "a/b/c",
                    resolved: true,
                    version: "~> 6.0",
                    line: 2,
                    column: 12,
                },
                {
                    name: "required_providers.aws",
                    block: "required_providers",
                    source: "hashicorp/aws",
                    written: "hashicorp/aws",
                    resolved: true,
                    version: "",
                    line: 9,
                    column: 23,
                },
            ];

            // Act
            const declarations = readModuleDeclarations(emitted);

            // Assert
            expect<TerraformModule[]>(declarations).toEqual([
                {
                    moduleName: "vpc",
                    block: "module",
                    source: "a/b/c",
                    versionConstraint: "~> 6.0",
                    sourcePosition: { line: 2, column: 12 },
                    writtenSource: "a/b/c",
                    sourceResolved: true,
                },
                {
                    moduleName: "required_providers.aws",
                    block: "required_providers",
                    source: "hashicorp/aws",
                    versionConstraint: "",
                    sourcePosition: { line: 9, column: 23 },
                    writtenSource: "hashicorp/aws",
                    sourceResolved: true,
                },
            ]);
        });
    });

    describe("When a version, position, written source or resolution is missing or the wrong type", () => {
        test("Then I expect it read as unresolved, written as its source, with no version or position", () => {
            // Arrange
            const emitted = [
                {
                    name: "vpc",
                    block: "module",
                    source: "a/b/c",
                    version: 5,
                    line: "2",
                    column: "12",
                },
            ];

            // Act
            const declarations = readModuleDeclarations(emitted);

            // Assert
            expect<TerraformModule[]>(declarations).toEqual([
                {
                    moduleName: "vpc",
                    block: "module",
                    source: "a/b/c",
                    versionConstraint: "",
                    sourcePosition: null,
                    writtenSource: "a/b/c",
                    sourceResolved: false,
                },
            ]);
        });
    });

    describe("When only one of the line and the column is a number", () => {
        test("Then I expect no position, because a line alone cannot be placed", () => {
            // Arrange
            const declared = { name: "vpc", block: "module", source: "a/b/c" };
            const emitted = [
                { ...declared, line: 2 },
                { ...declared, column: 12 },
            ];

            // Act
            const declarations = readModuleDeclarations(emitted);

            // Assert
            expect(declarations.map((module) => module.sourcePosition)).toEqual([null, null]);
        });
    });

    describe("When one lacks a name, a known block type or a source", () => {
        test("Then I expect it left out and the rest read", () => {
            // Arrange
            const emitted = [
                null,
                "vpc",
                { block: "module", source: "a/b/c" },
                { name: "", block: "module", source: "a/b/c" },
                { name: "a", block: "resource", source: "a/b/c" },
                { name: "b", block: "module", source: 1 },
                { name: "kept", block: "module", source: "a/b/c" },
            ];

            // Act
            const declarations = readModuleDeclarations(emitted);

            // Assert
            expect<string[]>(declarations.map((module) => module.moduleName)).toEqual(["kept"]);
        });
    });

    describe("When they are not a list", () => {
        test("Then I expect none", () => {
            // Arrange
            const emitted = [undefined, null, {}, "[]", { module: { vpc: [{ source: "a" }] } }];

            // Act
            const read = emitted.map(readModuleDeclarations);

            // Assert
            expect<TerraformModule[][]>(read).toEqual([[], [], [], [], []]);
        });
    });
});

describe("Given a declaration from every block type there is", () => {
    describe("When they are read", () => {
        test("Then I expect none dropped, because the check is derived from the same list", () => {
            // Arrange
            const blocks = Object.values(DECLARATION_BLOCKS);
            const emitted = blocks.map((block) => ({ name: block, block, source: "a/b/c" }));

            // Act
            const read = readModuleDeclarations(emitted).map((declaration) => declaration.block);

            // Assert
            expect(read).toEqual(blocks);
        });
    });
});
