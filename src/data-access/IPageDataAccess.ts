import { Nullable } from "../types/Nullable";
import { HclFileTypes } from "../types/HclFileTypes";

/** Reading the file page a host rendered. */
export interface IPageDataAccess {
    getFileType(): Nullable<HclFileTypes>;
    getFileName(): string;
    readSourceTextAsync(): Promise<Nullable<string>>;
    readCommitSha(): Nullable<string>;
}
