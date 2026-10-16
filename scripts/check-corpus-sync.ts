// Checks that the corpus still matches the fixture repository.
//
// Invoke via: make check-corpus-sync

import { MODULE_SOURCE_CORPUS } from "../tests/unit/fixtures/module-sources";

const RAW = "https://raw.githubusercontent.com/NickSpaghetti/iac-module-linker-fixtures/main";
const COMMENT_MARKER = "#";
const SOURCE_KEYWORD = "source";
const ASSIGNMENT = "=";

/** Spells a parsed source the way an HCL string literal writes it. */
const toHclLiteral = (source: string): string =>
    source.split("\\").join("\\\\").split('"').join('\\"');

const fetchFileAsync = async (file: string): Promise<string> => {
    const response = await fetch(`${RAW}/${file}`);
    if (!response.ok) {
        throw new Error(`${file} is not in the fixture repository (${response.status})`);
    }
    return await response.text();
};

/** Counts `source = ...` assignments, ignoring commented lines. */
const countSourceAssignments = (contents: string): number => {
    let count = 0;
    for (const line of contents.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith(COMMENT_MARKER)) {
            continue;
        }
        const keywordAt = trimmed.indexOf(SOURCE_KEYWORD);
        if (keywordAt === -1) {
            continue;
        }
        if (trimmed.indexOf(ASSIGNMENT, keywordAt + SOURCE_KEYWORD.length) !== -1) {
            count += 1;
        }
    }
    return count;
};

async function checkAsync(): Promise<void> {
    const files = [...new Set(MODULE_SOURCE_CORPUS.map((row) => row.file))].sort();
    const contents = new Map<string, string>();
    for (const file of files) {
        contents.set(file, await fetchFileAsync(file));
    }

    const problems: string[] = [];

    for (const row of MODULE_SOURCE_CORPUS) {
        if (!(contents.get(row.file) ?? "").includes(toHclLiteral(row.source))) {
            problems.push(`${row.id}: source is no longer in ${row.file}`);
        }
    }

    for (const file of files) {
        const inFile = countSourceAssignments(contents.get(file) ?? "");
        const inCorpus = MODULE_SOURCE_CORPUS.filter((row) => row.file === file).length;
        if (inFile !== inCorpus) {
            problems.push(`${file}: ${inFile} sources in the repo, ${inCorpus} in the corpus`);
        }
    }

    if (problems.length > 0) {
        console.error(`corpus and fixtures disagree:\n  ${problems.join("\n  ")}`);
        console.error(`\nRegenerate the corpus skeleton from the fixture repository.`);
        process.exit(1);
    }

    console.log(`${MODULE_SOURCE_CORPUS.length} corpus rows across ${files.length} files`);
    console.log("corpus and fixture repository agree");
}

checkAsync().catch((error) => {
    console.error(error);
    process.exit(1);
});
