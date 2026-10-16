import { expect } from "@jest/globals";
import {
    CONSTRAINT_OUTCOMES,
    selectVersion,
    toVersionConstraint,
    TERRAFORM_VERSION_CONSTRAINTS,
} from "../../../src/domain/VersionConstraint";
import { normalizeConstraint } from "../../../src/domain/ConstraintClauses";
import { semverVersionsOf } from "../../../src/domain/SemverVersion";
import { Nullable } from "../../../src/types/Nullable";

/** The versions the registry publishes in every case below. */
const PUBLISHED = semverVersionsOf([
    "1.0.0",
    "1.2.0",
    "1.2.3",
    "1.3.0",
    "1.9.9",
    "2.0.0",
    "2.4.0",
    "3.0.0",
    "5.0.0",
    "5.4.0",
    "6.7.3",
]);

// The version a constraint selects out of the published set.
const resolve = (constraint: string): Nullable<string> =>
    selectVersion(PUBLISHED, toVersionConstraint(constraint));

describe("Given a version constraint", () => {
    describe("When the constraint is empty", () => {
        test("Then I expect the highest published version", () => {
            // Act
            const selected = resolve("");

            // Assert
            expect<Nullable<string>>(selected).toBe("6.7.3");
        });
    });

    describe("When the constraint is empty or only separators", () => {
        test("Then I expect it read as any version", () => {
            // Arrange
            const constraints = ["", " ", " , "];

            // Act
            const outcomes = constraints.map(
                (constraint) => toVersionConstraint(constraint).outcome,
            );

            // Assert
            expect<string[]>(outcomes).toEqual(constraints.map(() => CONSTRAINT_OUTCOMES.ANY));
        });
    });

    describe("When nothing published satisfies the constraint", () => {
        test("Then I expect null rather than an empty string", () => {
            // Act
            const selected = resolve(">= 99.0.0");

            // Assert
            expect<Nullable<string>>(selected).toBeNull();
        });
    });

    describe("When the constraint is a bare version", () => {
        test("Then I expect that exact version", () => {
            // Arrange
            const cases = [
                { constraint: "6.7.3", selected: "6.7.3" },
                { constraint: "= 3.0.0", selected: "3.0.0" },
            ];

            // Act
            const resolved = cases.map(({ constraint }) => ({
                constraint,
                selected: resolve(constraint),
            }));

            // Assert
            expect(resolved).toEqual(cases);
        });
    });

    describe("When the version omits a part", () => {
        test("Then I expect it padded, not read as a range", () => {
            // Arrange
            const cases = [
                { constraint: ">= 5.0", selected: "6.7.3" },
                { constraint: "3", selected: "3.0.0" },
            ];

            // Act
            const resolved = cases.map(({ constraint }) => ({
                constraint,
                selected: resolve(constraint),
            }));

            // Assert
            expect(resolved).toEqual(cases);
        });
    });

    describe("When the constraint has one bound", () => {
        test("Then I expect that comparison applied", () => {
            // Arrange
            const cases = [
                { constraint: ">= 3.0.0", selected: "6.7.3" },
                { constraint: "<= 2.0.0", selected: "2.0.0" },
                { constraint: "> 5.4.0", selected: "6.7.3" },
                { constraint: "< 1.3.0", selected: "1.2.3" },
            ];

            // Act
            const resolved = cases.map(({ constraint }) => ({
                constraint,
                selected: resolve(constraint),
            }));

            // Assert
            expect(resolved).toEqual(cases);
        });
    });

    describe("When the constraint has two bounds", () => {
        test("Then I expect both kept", () => {
            // Arrange
            const cases = [
                { constraint: ">= 1.0, < 2.0", selected: "1.9.9" },
                { constraint: ">= 2.0.0, <= 3.0.0", selected: "3.0.0" },
            ];

            // Act
            const resolved = cases.map(({ constraint }) => ({
                constraint,
                selected: resolve(constraint),
            }));

            // Assert
            expect(resolved).toEqual(cases);
        });
    });

    describe("When the constraint is pessimistic with a patch", () => {
        test("Then I expect the minor pinned", () => {
            // Act
            const selected = resolve("~> 1.2.3");

            // Assert
            expect<Nullable<string>>(selected).toBe("1.2.3");
        });
    });

    describe("When the constraint is pessimistic without a patch", () => {
        test("Then I expect the major pinned", () => {
            // Arrange
            const constraints = ["~> 1.2", "~> 1"];

            // Act
            const resolved = constraints.map(resolve);

            // Assert
            expect<Nullable<string>[]>(resolved).toEqual(constraints.map(() => "1.9.9"));
        });
    });

    describe("When the constraint has no spaces", () => {
        test("Then I expect it read the same", () => {
            // Act
            const selected = resolve(">=2.0.0,<3.0.0");

            // Assert
            expect<Nullable<string>>(selected).toBe("2.4.0");
        });
    });

    describe("When the constraint excludes a version", () => {
        test("Then I expect the excluded version passed over", () => {
            // Act
            const selected = resolve(">= 1.0.0, <= 1.2.3, != 1.2.3");

            // Assert
            expect<Nullable<string>>(selected).toBe("1.2.0");
        });

        test("Then I expect an exclusion alone to leave every other version open", () => {
            // Act
            const selected = resolve("!= 6.7.3");

            // Assert
            expect<Nullable<string>>(selected).toBe("5.4.0");
        });
    });

    describe("When the version carries a prerelease", () => {
        test("Then I expect it compared rather than padded", () => {
            // Act
            const constraint = toVersionConstraint(">= 5.0.0-beta1");

            // Assert
            expect(constraint).toEqual({
                outcome: CONSTRAINT_OUTCOMES.BOUNDED,
                comparators: [
                    {
                        operator: TERRAFORM_VERSION_CONSTRAINTS.GREATER_THAN_OR_EQUAL,
                        version: "5.0.0-beta1",
                    },
                ],
            });
        });
    });

    describe("When the constraint is an npm range terraform does not have", () => {
        test("Then I expect it unrecognized rather than resolved under npm rules", () => {
            // Arrange
            const npmRanges = ["^1.2.3", "~1.2.3", "1.2.x", "1.2.3 - 2.0.0"];

            // Act
            const read = npmRanges.map((npmRange) => ({
                outcome: toVersionConstraint(npmRange).outcome,
                selected: resolve(npmRange),
            }));

            // Assert
            expect(read).toEqual(
                npmRanges.map(() => ({
                    outcome: CONSTRAINT_OUTCOMES.UNRECOGNIZED,
                    selected: null,
                })),
            );
        });

        test("Then I expect one bad clause to reject the whole conjunction", () => {
            // Act
            const constraint = toVersionConstraint(">= 1.0.0, ^2.0.0");

            // Assert
            expect<string>(constraint.outcome).toBe(CONSTRAINT_OUTCOMES.UNRECOGNIZED);
        });
    });

    describe("When a pessimistic bound would pass the largest safe integer", () => {
        test("Then I expect the constraint unrecognized rather than a throw", () => {
            // Arrange
            const largest = Number.MAX_SAFE_INTEGER;
            const constraints = [`~> 1.${largest}.0`, `~> ${largest}`];

            // Act
            const outcomes = constraints.map(
                (constraint) => toVersionConstraint(constraint).outcome,
            );

            // Assert
            expect<string[]>(outcomes).toEqual(
                constraints.map(() => CONSTRAINT_OUTCOMES.UNRECOGNIZED),
            );
        });
    });

    describe("When the version is not a version", () => {
        test("Then I expect the constraint unrecognized", () => {
            // Arrange
            const constraints = ["banana", ">= banana"];

            // Act
            const outcomes = constraints.map(
                (constraint) => toVersionConstraint(constraint).outcome,
            );

            // Assert
            expect<string[]>(outcomes).toEqual(
                constraints.map(() => CONSTRAINT_OUTCOMES.UNRECOGNIZED),
            );
        });
    });
});

describe("Given a constraint to show in a list", () => {
    const OPERATORS = Object.values(TERRAFORM_VERSION_CONSTRAINTS);

    describe("When the constraint is already spaced", () => {
        test("Then I expect it unchanged", () => {
            // Arrange
            const constraints = [">= 3.5.0, < 4.0.0", "3.0.0", ""];

            // Act
            const normalized = constraints.map(normalizeConstraint);

            // Assert
            expect<string[]>(normalized).toEqual(constraints);
        });
    });

    // Every operator, and every pair of them, the way the old formatter was
    // covered. One escaping mistake in the scan shows up here and nowhere else.
    describe.each(OPERATORS)("When the constraint leads with %s", (operator) => {
        test("Then I expect one space after the operator", () => {
            // Arrange
            const constraint = `${operator}3.0.0`;

            // Act
            const normalized = normalizeConstraint(constraint);

            // Assert
            expect<string>(normalized).toBe(`${operator} 3.0.0`);
        });

        test("Then I expect the operator kept, not expanded", () => {
            // Arrange
            const constraint = `${operator} 3.0.0`;

            // Act
            const normalized = normalizeConstraint(constraint);

            // Assert
            expect<string>(normalized).toBe(`${operator} 3.0.0`);
        });

        describe.each(OPERATORS)("and the second clause leads with %s", (second) => {
            test("Then I expect both spaced and comma separated", () => {
                // Arrange
                const constraint = `${operator}3.0.0,${second}4.0.0`;

                // Act
                const normalized = normalizeConstraint(constraint);

                // Assert
                expect<string>(normalized).toBe(`${operator} 3.0.0, ${second} 4.0.0`);
            });
        });
    });

    describe("When a clause is empty", () => {
        test("Then I expect it dropped rather than left as a stray comma", () => {
            // Arrange
            const cases = [
                { constraint: ">= 3.0.0,", normalized: ">= 3.0.0" },
                { constraint: ",", normalized: "" },
            ];

            // Act
            const read = cases.map(({ constraint }) => ({
                constraint,
                normalized: normalizeConstraint(constraint),
            }));

            // Assert
            expect(read).toEqual(cases);
        });
    });
});
