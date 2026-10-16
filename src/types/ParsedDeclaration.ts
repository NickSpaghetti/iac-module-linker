/** The types of block a declaration is read from, as the parser spells them. */
export const DECLARATION_BLOCKS = {
    TERRAFORM: "terraform",
    REQUIRED_PROVIDERS: "required_providers",
    MODULE: "module",
} as const;

/** The type of block a declaration is read from. */
export type DeclarationBlock = (typeof DECLARATION_BLOCKS)[keyof typeof DECLARATION_BLOCKS];

/**
 * Determines whether a value is a declaration block.
 * @param value The value to test.
 * @returns true if value is a DeclarationBlock; otherwise, false.
 */
export const isDeclarationBlock = (value: unknown): value is DeclarationBlock =>
    Object.values(DECLARATION_BLOCKS).some((block) => block === value);

/** A module source as the wasm parser emits it. Mirrors `Declaration` in `wasm/declarations`. */
export type ParsedDeclaration = {
    /** The module name, "terraform", or "required_providers.<name>". */
    name: string;
    /** The type of block it is read from. */
    block: DeclarationBlock;
    /** The source address. For a module it is evaluated against the file's variables and locals. */
    source: string;
    /** The source as the file writes it, without the quotes around a string. */
    written: string;
    /** false when the source could not be evaluated from the file, in which case `source` is `written`. */
    resolved: boolean;
    /** The version constraint, or "" when none evaluates to a string. */
    version: string;
    /** The 1-based line the source is written on. */
    line: number;
    /** The 0-based offset of `written`'s first character within its line, in UTF-16 code units. */
    column: number;
};
