import { DisplayModule, emptyDisplayModule } from "../types/DisplayModule";
import { TerraformModule } from "../types/Terraform";
import { ModuleSourceLinker } from "./ModuleSourceLinker";
import { split } from "../domain/moduleSource/Split";
import { detect } from "../domain/moduleSource/Detect";
import { classify } from "../domain/moduleSource/Classify";
import { isSafeHttpUrl } from "../util/UrlSafety";
import { logRecovered } from "../util/Log";

/**
 * @param uri The page the module was read from, which relative sources resolve against.
 * @param terraformModule One declaration read out of the file.
 * @param moduleSourceLinker Shared by every module on the page.
 * @returns The row the popup and the content script render.
 * @throws When `uri` is not an http or https address.
 */
export const buildDisplayModuleAsync = async (
    uri: string,
    terraformModule: TerraformModule,
    moduleSourceLinker: ModuleSourceLinker,
): Promise<DisplayModule> => {
    if (!isSafeHttpUrl(uri)) {
        throw new Error(`page url is not an http address: ${uri}`);
    }

    const module = emptyDisplayModule(terraformModule.moduleName);
    module.versionConstraint = terraformModule.versionConstraint;
    module.sourcePosition = terraformModule.sourcePosition;
    const source = terraformModule.source;
    if (source === "") {
        return module;
    }

    module.source = source;
    module.writtenSource = terraformModule.writtenSource;
    if (!terraformModule.sourceResolved) {
        return module;
    }
    const moduleSource = classify(detect(split(source)));
    module.sourceType = moduleSource.sourceType;

    try {
        const link = await moduleSourceLinker.linkAsync(
            moduleSource,
            terraformModule.block,
            module.versionConstraint,
            new URL(uri),
        );
        module.resolvedUrl = link.url;
        module.resolvedVersion = link.resolvedVersion;
    } catch (error) {
        logRecovered("could not build a link", { source, error });
    }
    return module;
};
