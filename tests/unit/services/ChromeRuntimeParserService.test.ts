import { expect } from "@jest/globals";
import { ChromeRuntimeParserService } from "../../../src/services/ChromeRuntimeParserService";
import { WORKER_QUERIES } from "../../../src/types/WorkerRequest";
import { TerraformModule } from "../../../src/types/Terraform";
import { PARSE_OUTCOMES } from "../../../src/types/ParseResponse";
import { clearChromeRuntime, stubChromeRuntime } from "./ChromeRuntimeStub";

/** The declarations a worker answers with when the parse succeeded. */
const parsed = [
    {
        name: "vpc",
        block: "module",
        source: "./modules/vpc",
        written: "./modules/vpc",
        resolved: true,
        version: "",
        line: 1,
        column: 13,
    },
];

const service = new ChromeRuntimeParserService();
const CONTENTS = 'module "vpc" { source = "./modules/vpc" }';
const FILE_NAME = "main.tf";

afterEach(() => clearChromeRuntime());

describe("Given the service worker parses the file", () => {
    describe("When a file is parsed", () => {
        test("Then I expect the declarations read into modules", async () => {
            // Arrange
            stubChromeRuntime(() => ({ outcome: PARSE_OUTCOMES.PARSED, declarations: parsed }));

            // Act
            const declarations = await service.parseAsync(CONTENTS, FILE_NAME);

            // Assert
            expect<TerraformModule[]>(declarations).toEqual([
                {
                    moduleName: "vpc",
                    block: "module",
                    source: "./modules/vpc",
                    versionConstraint: "",
                    sourcePosition: { line: 1, column: 13 },
                    writtenSource: "./modules/vpc",
                    sourceResolved: true,
                },
            ]);
        });

        test("Then I expect a malformed declaration left out", async () => {
            // Arrange
            stubChromeRuntime(() => ({
                outcome: PARSE_OUTCOMES.PARSED,
                declarations: [...parsed, { name: "bad", block: "resource", source: "x" }],
            }));

            // Act
            const declarations = await service.parseAsync(CONTENTS, FILE_NAME);

            // Assert
            expect<string[]>(declarations.map((module) => module.moduleName)).toEqual(["vpc"]);
        });
    });

    describe("When the message is sent", () => {
        test("Then I expect the contents and file name carried with the query", async () => {
            // Arrange
            const stub = stubChromeRuntime(() => ({
                outcome: PARSE_OUTCOMES.PARSED,
                declarations: parsed,
            }));

            // Act
            await service.parseAsync(CONTENTS, FILE_NAME);

            // Assert
            expect<unknown>(stub.sent[0]).toEqual({
                contentScriptQuery: WORKER_QUERIES.PARSE,
                contents: CONTENTS,
                fileName: FILE_NAME,
            });
        });
    });
});

describe("Given the service worker reports a parse error", () => {
    describe("When a file is parsed", () => {
        test("Then I expect the error surfaced, not swallowed", async () => {
            // Arrange
            stubChromeRuntime(() => ({
                outcome: PARSE_OUTCOMES.FAILED,
                error: "main.tf:3,1-2: Argument or block definition required",
            }));

            // Act
            const parsing = service.parseAsync(CONTENTS, FILE_NAME);

            // Assert
            await expect(parsing).rejects.toThrow("Argument or block definition required");
        });
    });
});

describe("Given the service worker goes away before answering", () => {
    describe("When a file is parsed", () => {
        test("Then I expect a throw naming the silence", async () => {
            // Arrange
            stubChromeRuntime(() => undefined);

            // Act
            const parsing = service.parseAsync(CONTENTS, FILE_NAME);

            // Assert
            await expect(parsing).rejects.toThrow("the parser did not respond");
        });

        test("Then I expect the reason chrome reports carried in the throw", async () => {
            // Arrange
            const portClosed = {
                message: "The message port closed before a response was received.",
            };
            stubChromeRuntime(() => undefined, portClosed);

            // Act
            const parsing = service.parseAsync(CONTENTS, FILE_NAME);

            // Assert
            await expect(parsing).rejects.toThrow(
                `the parser did not respond: ${portClosed.message}`,
            );
        });
    });
});

describe("Given the service worker answers parsed but sends no file", () => {
    describe("When a file is parsed", () => {
        test("Then I expect a throw naming a bad answer, not silence", async () => {
            // Arrange
            stubChromeRuntime(() => ({ outcome: PARSE_OUTCOMES.PARSED }));

            // Act
            const parsing = service.parseAsync(CONTENTS, FILE_NAME);

            // Assert
            await expect(parsing).rejects.toThrow(
                "the parser answered with something that is not a parse response",
            );
        });
    });
});

describe("Given the service worker reports an error that is not text", () => {
    describe("When a file is parsed", () => {
        test("Then I expect a throw naming a bad answer, not silence", async () => {
            // Arrange
            stubChromeRuntime(() => ({
                outcome: PARSE_OUTCOMES.FAILED,
                error: { message: "boom" },
            }));

            // Act
            const parsing = service.parseAsync(CONTENTS, FILE_NAME);

            // Assert
            await expect(parsing).rejects.toThrow(
                "the parser answered with something that is not a parse response",
            );
        });
    });
});
