import { BrowserContext, Page, Response } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { test, expect, FIXTURES, GITLAB_FIXTURES, openPopupAsync } from "../extension";

const ANCHOR = 'a[id^="GitlabTerraformSourceUrl"]';
const ACCESS = ".ml-access";

const GITLAB_ORIGIN = new URL(GITLAB_FIXTURES).origin;

/** Read by the workflows, which turn each line into a warning on the run. */
const RATE_LIMIT_REPORT = "gitlab-rate-limited.txt";

const TOO_MANY_REQUESTS = 429;

/** The headers gitlab.com explains a 429 with. */
const RATE_LIMIT_HEADERS = {
    NAME: "ratelimit-name",
    RETRY_AFTER: "retry-after",
} as const;

// gitlab.com counts unauthenticated requests per IP by the hour, and a file
// page asks for these on load though no test reads them. Aborted, they are
// never sent, so they do not count.
const UNUSED_GITLAB_REQUESTS = [
    `${GITLAB_ORIGIN}/api/v4/projects/*/repository/tags**`,
    `${GITLAB_ORIGIN}/api/v4/projects/*/repository/branches**`,
    `${GITLAB_ORIGIN}/-/manifest.json`,
    `${GITLAB_ORIGIN}/-/pwa-icons/**`,
];

/** What a rate limit header reads when gitlab.com leaves it out. */
const UNSTATED = "unstated";

/** The limit gitlab.com refused a request under. */
type RateLimit = { readonly name: string; readonly retryAfterSeconds: string };

let rateLimit: RateLimit | null = null;

const recordRateLimit = (response: Response): void => {
    if (
        rateLimit !== null ||
        response.status() !== TOO_MANY_REQUESTS ||
        !response.url().startsWith(GITLAB_ORIGIN)
    ) {
        return;
    }
    const headers = response.headers();
    rateLimit = {
        name: headers[RATE_LIMIT_HEADERS.NAME] ?? UNSTATED,
        retryAfterSeconds: headers[RATE_LIMIT_HEADERS.RETRY_AFTER] ?? UNSTATED,
    };
};

/** Skips the running test, and reports it, once gitlab.com has rate limited the run. */
const skipIfRateLimited = (): void => {
    if (rateLimit === null) {
        return;
    }
    const reason = `gitlab.com rate limited this runner (${rateLimit.name}, retry after ${rateLimit.retryAfterSeconds}s)`;
    const testInfo = test.info();
    fs.mkdirSync(testInfo.project.outputDir, { recursive: true });
    fs.appendFileSync(
        path.join(testInfo.project.outputDir, RATE_LIMIT_REPORT),
        `${testInfo.title}: ${reason}\n`,
    );
    test.skip(true, reason);
};

type GitLabTestArgs = { context: BrowserContext; extensionId: string };

/** Wraps a test against gitlab.com so it is skipped, not failed, when gitlab.com rate limits it. */
const rateLimited =
    (body: (args: GitLabTestArgs) => Promise<void>) =>
    async ({ context, extensionId }: GitLabTestArgs): Promise<void> => {
        skipIfRateLimited();
        for (const unused of UNUSED_GITLAB_REQUESTS) {
            await context.route(unused, (route) => route.abort());
        }
        context.on("response", recordRateLimit);
        try {
            await body({ context, extensionId });
        } catch (error) {
            skipIfRateLimited();
            throw error;
        }
    };

/** `benchmarks/resolution/large.tf`: its last line, and how many module sources it declares. */
const LARGE_FILE_LAST_LINE = 205;
const LARGE_FILE_SOURCES = 40;

/**
 * Reads every anchor this extension injected into the rendered file.
 * @param page The page to read from.
 * @returns The source text and the link built for it, one entry per anchor.
 */
const readAnchors = async (page: Page) =>
    await page.evaluate(
        (selector) =>
            Array.from(document.querySelectorAll(selector)).map((a) => ({
                text: a.textContent ?? "",
                href: (a as HTMLAnchorElement).href,
            })),
        ANCHOR,
    );

/**
 * Reads the lines GitLab rendered that assign a source but hold no anchor.
 * @param page The page to read from.
 * @returns The id of each such line.
 */
const readUnlinkedSourceLines = async (page: Page) =>
    await page.evaluate(
        (selector) =>
            Array.from(document.querySelectorAll(".line[id^='LC']"))
                .filter((line) => (line.textContent ?? "").trim().startsWith("source"))
                .filter((line) => line.querySelector(selector) === null)
                .map((line) => line.id),
        ANCHOR,
    );

/**
 * Opens a fixture on GitLab with the cache cleared.
 * @param page The page to open it on.
 * @param file The fixture's path in the repository.
 */
const openFixtureAsync = async (page: Page, file: string) => {
    await page
        .context()
        .serviceWorkers()[0]
        .evaluate(async () => await chrome.storage.session.clear());
    await page.goto(`${GITLAB_FIXTURES}/-/blob/main/${file}`, { waitUntil: "domcontentloaded" });
};

test.describe("with gitlab.com allowed", () => {
    test.use({ grantOptionalHosts: true });

    test(
        "links are injected on the first visit to a GitLab page",
        rateLimited(async ({ context }) => {
            // Arrange
            const page = await context.newPage();

            // Act
            await openFixtureAsync(page, "01-local-paths.tf");
            await expect
                .poll(async () => (await readAnchors(page)).length, { timeout: 20_000 })
                .toBe(3);

            // Assert
            expect(await readAnchors(page)).toEqual([
                { text: "./modules/vpc", href: `${GITLAB_FIXTURES}/-/tree/main/modules/vpc` },
                {
                    text: "./modules/vpc/main.tf",
                    href: `${GITLAB_FIXTURES}/-/blob/main/modules/vpc/main.tf`,
                },
                { text: "./modules/lambda", href: `${GITLAB_FIXTURES}/-/tree/main/modules/lambda` },
            ]);
        }),
    );

    test(
        "a GitLab link opens its target when clicked",
        rateLimited(async ({ context }) => {
            // Arrange
            const page = await context.newPage();
            await openFixtureAsync(page, "01-local-paths.tf");
            const anchor = page.locator(ANCHOR).first();
            await expect(anchor).toBeVisible({ timeout: 20_000 });

            // Act
            const [opened] = await Promise.all([context.waitForEvent("page"), anchor.click()]);

            // Assert
            await expect
                .poll(() => opened.url())
                .toBe(`${GITLAB_FIXTURES}/-/tree/main/modules/vpc`);
        }),
    );

    test(
        "a .tofu file and a .tf.json file are linked on GitLab",
        rateLimited(async ({ context }) => {
            // Arrange
            const page = await context.newPage();
            const linked: Record<string, string[]> = {};

            // Act
            for (const file of ["15-everything.tofu", "16-everything.tf.json"]) {
                await openFixtureAsync(page, file);
                await expect
                    .poll(async () => (await readAnchors(page)).length, { timeout: 20_000 })
                    .toBeGreaterThan(0);
                linked[file] = (await readAnchors(page)).map((anchor) => anchor.href);
            }

            // Assert
            const tofu = linked["15-everything.tofu"];
            const json = linked["16-everything.tf.json"];
            expect(tofu.some((h) => new URL(h).hostname === "registry.terraform.io")).toBe(true);
            expect(tofu.some((h) => h.includes("iac-module-linker-fixtures/tree/v1.0.0"))).toBe(
                true,
            );
            expect(tofu.some((h) => h.startsWith("oci://"))).toBe(false);
            expect(json.some((h) => new URL(h).hostname === "registry.terraform.io")).toBe(true);
            expect(json).toContain(`${GITLAB_FIXTURES}/-/tree/main/modules/vpc`);
        }),
    );

    test(
        "sources in chunks GitLab renders on scroll are linked",
        rateLimited(async ({ context }) => {
            // Arrange
            const page = await context.newPage();
            await openFixtureAsync(page, "benchmarks/resolution/large.tf");
            await expect
                .poll(async () => (await readAnchors(page)).length, { timeout: 20_000 })
                .toBeGreaterThan(0);
            const firstChunk = (await readAnchors(page)).length;

            // Act
            // GitLab renders a chunk once it scrolls into view, so the wheel keeps
            // going until the file's last line exists.
            const box = await page.locator("#LC5").boundingBox();
            await page.mouse.move((box?.x ?? 0) + 100, box?.y ?? 0);
            await expect
                .poll(
                    async () => {
                        await page.mouse.wheel(0, 400);
                        return await page.locator(`#LC${LARGE_FILE_LAST_LINE}`).count();
                    },
                    { timeout: 20_000, intervals: [100] },
                )
                .toBe(1);

            // Assert
            expect(firstChunk).toBeLessThan(LARGE_FILE_SOURCES);
            await expect
                .poll(async () => await readUnlinkedSourceLines(page), { timeout: 10_000 })
                .toEqual([]);
            expect(await readAnchors(page)).toHaveLength(LARGE_FILE_SOURCES);
        }),
    );

    test(
        "links are injected after navigating within GitLab",
        rateLimited(async ({ context }) => {
            // Arrange
            const page = await context.newPage();
            await page.goto(`${GITLAB_FIXTURES}/-/tree/main`, { waitUntil: "domcontentloaded" });

            // Act
            await page.getByRole("link", { name: "01-local-paths.tf" }).first().click();
            await page.waitForURL("**/-/blob/main/01-local-paths.tf**");

            // Assert
            await expect
                .poll(async () => (await readAnchors(page)).length, { timeout: 20_000 })
                .toBe(3);
        }),
    );

    test(
        "moving to another file within GitLab links it with its own sources",
        rateLimited(async ({ context }) => {
            // Arrange
            const page = await context.newPage();
            await openFixtureAsync(page, "01-local-paths.tf");
            await expect
                .poll(async () => (await readAnchors(page)).length, { timeout: 20_000 })
                .toBe(3);
            // Survives a move within GitLab, dies on a reload. Without it this
            // would measure a second page load.
            await page.evaluate(
                () => ((globalThis as unknown as { s: string }).s = "same document"),
            );

            // Act
            await page
                .locator('a[href*="/-/blob/main/17-duplicate-sources.tf"]:visible')
                .first()
                .click();
            await page.waitForURL("**/-/blob/main/17-duplicate-sources.tf**");

            // Assert
            const sameDocument = await page.evaluate(
                () => (globalThis as unknown as { s?: string }).s ?? "reloaded",
            );
            expect(sameDocument).toBe("same document");
            await expect
                .poll(async () => (await readAnchors(page)).map((anchor) => anchor.text), {
                    timeout: 20_000,
                })
                .toEqual(["hashicorp/consul/aws", "hashicorp/consul/aws"]);
            const hrefs = (await readAnchors(page)).map((anchor) => new URL(anchor.href).hostname);
            expect(hrefs).toEqual(["registry.terraform.io", "registry.terraform.io"]);
        }),
    );

    test(
        "the popup lists a GitLab page's modules and asks for nothing",
        rateLimited(async ({ context, extensionId }) => {
            // Arrange
            const page = await context.newPage();
            await openFixtureAsync(page, "17-duplicate-sources.tf");
            await expect(page.locator(ANCHOR).first()).toBeVisible({ timeout: 20_000 });

            // Act
            const popup = await openPopupAsync(context, extensionId, page);
            await expect(popup.locator("ul.ml-list")).toBeVisible({ timeout: 15_000 });

            // Assert
            expect(await popup.locator("ul.ml-list > li").count()).toBe(2);
            expect(await popup.locator(ACCESS).count()).toBe(0);
        }),
    );
});

test.describe("with gitlab.com not yet allowed", () => {
    test(
        "a GitLab page is left unlinked",
        rateLimited(async ({ context }) => {
            // Arrange
            const page = await context.newPage();

            // Act
            await openFixtureAsync(page, "01-local-paths.tf");
            await expect(page.locator("#LC4")).toBeVisible({ timeout: 20_000 });
            await page.waitForTimeout(3_000);

            // Assert
            expect(await readAnchors(page)).toEqual([]);
        }),
    );

    test(
        "the popup offers to allow gitlab.com",
        rateLimited(async ({ context, extensionId }) => {
            // Arrange
            const page = await context.newPage();
            await openFixtureAsync(page, "01-local-paths.tf");

            // Act
            const popup = await openPopupAsync(context, extensionId, page);

            // Assert
            await expect(popup.locator(ACCESS)).toContainText("gitlab.com", { timeout: 15_000 });
            await expect(popup.getByRole("button", { name: "Allow on gitlab.com" })).toBeVisible();
            await expect(popup.locator(".ml-empty")).toHaveText(
                "Allow gitlab.com to see this page's modules.",
            );
        }),
    );

    test("the popup asks for nothing on GitHub", async ({ context, extensionId }) => {
        // Arrange
        const page = await context.newPage();
        await page.goto(`${FIXTURES}/blob/main/01-local-paths.tf`, {
            waitUntil: "domcontentloaded",
        });

        // Act
        const popup = await openPopupAsync(context, extensionId, page);
        await expect(popup.locator(".ml-search")).toBeVisible({ timeout: 15_000 });

        // Assert
        expect(await popup.locator(ACCESS).count()).toBe(0);
    });
});

/**
 * Reads each line GitLab rendered for the file being viewed, as the writer
 * selects them.
 * @param page The page to read from.
 * @returns Each line's id and text, in page order.
 */
const readRenderedLines = async (page: Page) =>
    await page.evaluate(() =>
        Array.from(document.querySelectorAll(".line[id^='LC']")).map((line) => ({
            id: line.id,
            text: line.textContent ?? "",
        })),
    );

/**
 * @param id An element id.
 * @returns The line number an `LC{n}` id names, or null when the id is not one.
 */
const lineNumberOf = (id: string): number | null => {
    const digits = id.slice("LC".length);
    const number = Number(digits);
    return id.startsWith("LC") && digits !== "" && Number.isInteger(number) && number > 0
        ? number
        : null;
};

// The GitLab writer relies on three things about GitLab's file view, and the
// unit tests build pages that assume them. These check them against gitlab.com,
// so a change on GitLab's side fails here with the assumption it broke.
test.describe("GitLab's file view still renders what the writer relies on", () => {
    test.use({ grantOptionalHosts: true });

    for (const file of [
        "01-local-paths.tf",
        "19-opentofu-static-evaluation.tofu",
        "16-everything.tf.json",
    ]) {
        test(
            `${file} renders numbered lines with its links outside inert`,
            rateLimited(async ({ context }) => {
                // Arrange
                const page = await context.newPage();
                const raw = await (
                    await page.request.get(`${GITLAB_FIXTURES}/-/raw/main/${file}`)
                ).text();
                const fileLines = raw.split("\n");

                // Act
                await openFixtureAsync(page, file);
                await expect
                    .poll(async () => (await readAnchors(page)).length, { timeout: 20_000 })
                    .toBeGreaterThan(0);
                const rendered = await readRenderedLines(page);

                // Assert
                expect(
                    rendered.map((line) => lineNumberOf(line.id)),
                    "the lines are .line elements numbered LC1, LC2, ... in order",
                ).toEqual(rendered.map((_, index) => index + 1));
                expect(
                    rendered
                        .filter((line) => line.text !== fileLines[(lineNumberOf(line.id) ?? 0) - 1])
                        .map((line) => ({
                            id: line.id,
                            rendered: line.text,
                            file: fileLines[(lineNumberOf(line.id) ?? 0) - 1],
                        })),
                    "each line's text is that line of the file, character for character",
                ).toEqual([]);
                expect(
                    await page.evaluate(
                        (selector) =>
                            Array.from(document.querySelectorAll(selector))
                                .filter((anchor) => anchor.closest("[inert]") !== null)
                                .map((anchor) => anchor.id),
                        ANCHOR,
                    ),
                    "GitLab's inert is on an element the writer lifts",
                ).toEqual([]);
            }),
        );
    }
});
