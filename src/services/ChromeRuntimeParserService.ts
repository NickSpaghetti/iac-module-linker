import { ParseRequest, WORKER_QUERIES } from "../types/WorkerRequest";
import { TerraformModule } from "../types/Terraform";
import { PARSE_OUTCOMES, ParseResponse } from "../types/ParseResponse";
import { readModuleDeclarations } from "../domain/ModuleDeclarationReader";
import { readParseResponse } from "../WorkerResponseGuards";
import { sendToWorkerAsync, withReason, WorkerFailures } from "./WorkerMessage";

const FAILURES: WorkerFailures<ParseResponse> = {
    noResponse: (reason) => ({
        outcome: PARSE_OUTCOMES.FAILED,
        error: withReason("the parser did not respond", reason),
    }),
    malformed: {
        outcome: PARSE_OUTCOMES.FAILED,
        error: "the parser answered with something that is not a parse response",
    },
};

/**
 * Parses HCL in the service worker, because wasm cannot be compiled in a
 * content script on github.com: the page's CSP has no `wasm-unsafe-eval` and
 * the isolated world does not escape it.
 */
export class ChromeRuntimeParserService {
    /**
     * @param contents The raw text of the file being viewed.
     * @param fileName The file's name. One ending in `.json` is read as JSON syntax.
     * @returns Each well-formed declaration in the file, in the order the file writes them.
     * @throws When the service worker reports a parse error, does not respond, or
     * answers with something that is not a parse response.
     */
    public async parseAsync(contents: string, fileName: string): Promise<TerraformModule[]> {
        const request: ParseRequest = {
            contentScriptQuery: WORKER_QUERIES.PARSE,
            contents: contents,
            fileName: fileName,
        };
        const response = await sendToWorkerAsync(request, readParseResponse, FAILURES);

        if (response.outcome === PARSE_OUTCOMES.FAILED) {
            throw new Error(response.error);
        }
        return readModuleDeclarations(response.declarations);
    }
}
