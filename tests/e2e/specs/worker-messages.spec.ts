import { test, expect } from "../extension";
import { FetchRequest, WORKER_QUERIES } from "../../../src/types/WorkerRequest";
import { FETCH_OUTCOMES } from "../../../src/types/RunTimeFetchResponse";
import { TERRAFORM_REGISTRY_HOST } from "../../../src/util/Constants";

const OUTCOMES = {
    SETTLED: "settled",
    STILL_WAITING: "still waiting",
} as const;

// Long enough for any real answer, short of the test timeout.
const SETTLE_WAIT_MS = 2_000;

const REGISTRY_ORIGIN = `https://${TERRAFORM_REGISTRY_HOST}`;

// Never from the browser cache, so the routed answer is the one read.
const CACHE_MODE: RequestCache = "no-store";

const RATE_LIMITED = {
    status: 429,
    contentType: "text/html",
    body: "<html>slow down</html>",
} as const;

// Holding an unhandled message's channel open leaves the sender waiting until the worker shuts down.
test("the service worker lets go of a message it does not handle", async ({
    context,
    extensionId,
}) => {
    // Arrange
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/index.html`);

    // Act
    const outcome = await page.evaluate(
        async ({ outcomes, waitMs }) =>
            await Promise.race([
                chrome.runtime.sendMessage({ unhandled: true }).then(
                    () => outcomes.SETTLED,
                    () => outcomes.SETTLED,
                ),
                new Promise<string>((resolve) =>
                    setTimeout(() => resolve(outcomes.STILL_WAITING), waitMs),
                ),
            ]),
        { outcomes: OUTCOMES, waitMs: SETTLE_WAIT_MS },
    );

    // Assert
    expect(outcome).toBe(OUTCOMES.SETTLED);
});

// Registries send rate limits as HTML, so an error status must not depend on the body.
test("a registry error status with a body that is not JSON is rejected with its status", async ({
    context,
    extensionId,
}) => {
    // Arrange
    await context.route(`${REGISTRY_ORIGIN}/**`, (route) => route.fulfill(RATE_LIMITED));
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    const request: FetchRequest = {
        contentScriptQuery: WORKER_QUERIES.FETCH,
        url: `${REGISTRY_ORIGIN}/v1/providers/hashicorp/aws`,
        cache: CACHE_MODE,
    };

    // Act
    const response: unknown = await page.evaluate(
        async (sent) => await chrome.runtime.sendMessage(sent),
        request,
    );

    // Assert
    expect(response).toEqual({
        outcome: FETCH_OUTCOMES.REJECTED,
        status: RATE_LIMITED.status,
    });
});
