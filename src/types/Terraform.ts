import { Nullable } from "./Nullable";
import { DeclarationBlock } from "./ParsedDeclaration";
import { SourcePosition } from "./SourcePosition";

/** A declaration read from a Terraform or OpenTofu file. */
export type TerraformModule = {
    /** The module name, "terraform", or "required_providers.<name>". */
    moduleName: string;
    /** The type of block it is read from. */
    block: DeclarationBlock;
    /** The source address, evaluated against the file's variables and locals. "" when the block has none. */
    source: string;
    /** The block's version constraint, or "" when it has none. */
    versionConstraint: string;
    /** Where the source is written, or null when the parser did not say. */
    sourcePosition: Nullable<SourcePosition>;
    /** The source as the file writes it, which a template's resolved source differs from. */
    writtenSource: string;
    /** false when the source could not be evaluated from the file, so it cannot be linked. */
    sourceResolved: boolean;
};
