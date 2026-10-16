import { Nullable } from "../types/Nullable";
import { isDeclarationBlock, ParsedDeclaration } from "../types/ParsedDeclaration";
import { readSourcePosition } from "../types/SourcePosition";
import { TerraformModule } from "../types/Terraform";
import { hasField, readString } from "../util/Fields";

const readDeclaration = (value: unknown): Nullable<TerraformModule> => {
    if (
        !hasField(value, "name") ||
        typeof value.name !== "string" ||
        value.name === "" ||
        !hasField(value, "block") ||
        !isDeclarationBlock(value.block) ||
        !hasField(value, "source") ||
        typeof value.source !== "string"
    ) {
        return null;
    }
    return {
        moduleName: value.name,
        block: value.block,
        source: value.source,
        versionConstraint: readString<ParsedDeclaration>(value, "version") ?? "",
        sourcePosition: readSourcePosition(value),
        writtenSource: readString<ParsedDeclaration>(value, "written") ?? value.source,
        sourceResolved: hasField(value, "resolved") && value.resolved === true,
    };
};

/**
 * Reads the declarations the parser emitted.
 * @param value The declarations as the parser emits them.
 * @returns Each declaration that has a name, a known block type and a source, in the
 * order the file writes them. Empty when `value` is not a list.
 */
export const readModuleDeclarations = (value: unknown): TerraformModule[] =>
    Array.isArray(value)
        ? value.map(readDeclaration).filter((module): module is TerraformModule => module !== null)
        : [];
