import { DisplayModule } from "../types/DisplayModule";
import { PlacedSourceLink, SourceLinks } from "../types/SourceLinks";

/**
 * Places each module source that has a url on its line.
 * @param modules The modules declared on the page.
 * @returns Each source whose url, line and column are known, by line, in module order.
 */
export const toSourceLinks = (modules: readonly DisplayModule[]): SourceLinks => {
    const placed = new Map<number, PlacedSourceLink[]>();
    for (const module of modules) {
        if (module.resolvedUrl === null || module.sourcePosition === null) {
            continue;
        }
        const { line, column } = module.sourcePosition;
        const onLine = placed.get(line) ?? [];
        onLine.push({ column: column, written: module.writtenSource, url: module.resolvedUrl });
        placed.set(line, onLine);
    }
    return placed;
};
