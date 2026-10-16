import { Nullable } from "./Nullable";

/** What a builder produces. `resolvedVersion` is "" unless a registry lookup decided it. */
export type ModuleLink = {
    readonly url: Nullable<string>;
    readonly resolvedVersion: string;
};
