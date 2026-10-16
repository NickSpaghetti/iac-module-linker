import { expect, jest } from "@jest/globals";
import { buildDisplayModuleAsync } from "../../../src/services/DisplayModuleBuilder";
import { TerraformModule } from "../../../src/types/Terraform";
import { Nullable } from "../../../src/types/Nullable";
import { SourceTypes } from "../../../src/types/SourceTypes";
import { stubModuleSourceLinker } from "./RegistryStubs";

const PAGE = "https://github.com/owner/repo/blob/main/main.tofu";

afterEach(() => {
    jest.restoreAllMocks();
});

describe("Given a module whose source the file cannot evaluate", () => {
    describe("When its row is built", () => {
        test("Then I expect the source as written, unlinked, without asking the linker", async () => {
            // Arrange
            const linker = stubModuleSourceLinker();
            const link = jest.spyOn(linker, "linkAsync");
            const module: TerraformModule = {
                moduleName: "vpc",
                block: "module",
                source: "${var.repo}//modules/vpc",
                versionConstraint: "",
                sourcePosition: { line: 9, column: 13 },
                writtenSource: "${var.repo}//modules/vpc",
                sourceResolved: false,
            };

            // Act
            const display = await buildDisplayModuleAsync(PAGE, module, linker);

            // Assert
            expect<string>(display.source).toBe("${var.repo}//modules/vpc");
            expect<SourceTypes>(display.sourceType).toBe(SourceTypes.unknown);
            expect<Nullable<string>>(display.resolvedUrl).toBeNull();
            expect(link).not.toHaveBeenCalled();
        });
    });
});

describe("Given a module whose source is a template the file evaluates", () => {
    describe("When its row is built", () => {
        test("Then I expect the evaluated source linked and the written one kept for the page", async () => {
            // Arrange
            const module: TerraformModule = {
                moduleName: "vpc",
                block: "module",
                source: "./modules/vpc",
                versionConstraint: "",
                sourcePosition: { line: 7, column: 13 },
                writtenSource: "${local.modules}/vpc",
                sourceResolved: true,
            };

            // Act
            const display = await buildDisplayModuleAsync(PAGE, module, stubModuleSourceLinker());

            // Assert
            expect<string>(display.source).toBe("./modules/vpc");
            expect<string>(display.writtenSource).toBe("${local.modules}/vpc");
            expect<Nullable<string>>(display.resolvedUrl).toBe(
                "https://github.com/owner/repo/tree/main/modules/vpc",
            );
        });
    });
});

describe("Given a module whose name contains required_providers", () => {
    describe("When its registry source is linked", () => {
        test.each([
            [
                "terraform-aws-modules/vpc/aws",
                "https://registry.terraform.io/modules/terraform-aws-modules/vpc/aws/5.0.0",
            ],
            [
                "registry.opentofu.org/terraform-aws-modules/vpc/aws",
                "https://search.opentofu.org/module/terraform-aws-modules/vpc/aws/5.0.0",
            ],
        ])("Then I expect %s linked as a module, not a provider", async (source, expected) => {
            // Arrange
            const module: TerraformModule = {
                moduleName: "required_providers_shim",
                block: "module",
                source,
                versionConstraint: "5.0.0",
                sourcePosition: { line: 3, column: 13 },
                writtenSource: source,
                sourceResolved: true,
            };

            // Act
            const display = await buildDisplayModuleAsync(PAGE, module, stubModuleSourceLinker());

            // Assert
            expect<Nullable<string>>(display.resolvedUrl).toBe(expected);
        });
    });
});
