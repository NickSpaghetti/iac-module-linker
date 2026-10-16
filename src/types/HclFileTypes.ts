/** The types of file the parser reads. */
export enum HclFileTypes {
    tf = "tf",
    hcl = "hcl",
    tofu = "tofu",
    tfJson = "tf.json",
    tofuJson = "tofu.json",
}

/** Each HCL file suffix and the type it marks, longest first. */
export const HCL_FILE_SUFFIXES: ReadonlyArray<readonly [string, HclFileTypes]> = [
    [".tofu.json", HclFileTypes.tofuJson],
    [".tf.json", HclFileTypes.tfJson],
    [".tofu", HclFileTypes.tofu],
    [".hcl", HclFileTypes.hcl],
    [".tf", HclFileTypes.tf],
];
