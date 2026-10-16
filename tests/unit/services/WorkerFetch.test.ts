import { expect } from "@jest/globals";
import { FETCH_REFUSALS, fetchForContentScriptAsync } from "../../../src/services/WorkerFetch";
import { FetchRequest, WORKER_QUERIES } from "../../../src/types/WorkerRequest";
import { TERRAFORM_REGISTRY_HOST } from "../../../src/util/Constants";
import { REGISTRY_CACHE_MODE } from "../../../src/data-access/RegistryApi";
import { FETCH_OUTCOMES, RunTimeFetchResponse } from "../../../src/types/RunTimeFetchResponse";

const request: FetchRequest = {
    contentScriptQuery: WORKER_QUERIES.FETCH,
    url: `https://${TERRAFORM_REGISTRY_HOST}/v1/providers/hashicorp/aws`,
    cache: REGISTRY_CACHE_MODE,
};

const NOT_ALLOWED_URL = "https://example.com/v1/providers/hashicorp/aws";

// A fetch that gives every url the same answer.
const answering =
    (body: string, status: number): typeof fetch =>
    () =>
        Promise.resolve(new Response(body, { status: status }));

describe("Given a registry that answers with JSON", () => {
    describe("When the fetch is made", () => {
        test("Then I expect the body answered", async () => {
            // Arrange
            const fetchAsync = answering('{"versions":["1.0.0"]}', 200);

            // Act
            const response = await fetchForContentScriptAsync(request, fetchAsync);

            // Assert
            expect<RunTimeFetchResponse>(response).toEqual({
                outcome: FETCH_OUTCOMES.OK,
                data: { versions: ["1.0.0"] },
            });
        });
    });

    describe("When the url and cache mode are passed on", () => {
        test("Then I expect the fetch made with both", async () => {
            // Arrange
            const made: [unknown, unknown][] = [];
            const fetchAsync: typeof fetch = (url, init) => {
                made.push([url, init?.cache]);
                return Promise.resolve(new Response("{}", { status: 200 }));
            };

            // Act
            await fetchForContentScriptAsync(request, fetchAsync);

            // Assert
            expect<[unknown, unknown][]>(made).toEqual([[request.url, request.cache]]);
        });
    });
});

describe("Given a registry that answers an error status", () => {
    describe("When the fetch is made", () => {
        test("Then I expect it rejected with its status, whatever the body", async () => {
            // Arrange
            const fetchAsync = answering("<html>rate limited</html>", 429);

            // Act
            const response = await fetchForContentScriptAsync(request, fetchAsync);

            // Assert
            expect<RunTimeFetchResponse>(response).toEqual({
                outcome: FETCH_OUTCOMES.REJECTED,
                status: 429,
            });
        });
    });
});

describe("Given a registry that answers an ok status with a body that is not JSON", () => {
    describe("When the fetch is made", () => {
        test("Then I expect a failure naming the body, not an empty answer", async () => {
            // Arrange
            const fetchAsync = answering("<html>sign in to this network</html>", 200);

            // Act
            const response = await fetchForContentScriptAsync(request, fetchAsync);

            // Assert
            expect<RunTimeFetchResponse>(response).toEqual({
                outcome: FETCH_OUTCOMES.FAILED,
                error: expect.stringContaining("SyntaxError"),
            });
        });
    });
});

describe("Given a fetch that throws", () => {
    describe("When the fetch is made", () => {
        test("Then I expect a failure carrying the reason", async () => {
            // Arrange
            const fetchAsync: typeof fetch = () => Promise.reject(new TypeError("Failed to fetch"));

            // Act
            const response = await fetchForContentScriptAsync(request, fetchAsync);

            // Assert
            expect<RunTimeFetchResponse>(response).toEqual({
                outcome: FETCH_OUTCOMES.FAILED,
                error: "TypeError: Failed to fetch",
            });
        });
    });
});

describe("Given a url on a host the extension may not reach", () => {
    describe("When the fetch is asked for", () => {
        test("Then I expect a failure and no fetch made", async () => {
            // Arrange
            let fetched = false;
            const fetchAsync: typeof fetch = () => {
                fetched = true;
                return Promise.resolve(new Response("{}"));
            };

            // Act
            const response = await fetchForContentScriptAsync(
                { ...request, url: NOT_ALLOWED_URL },
                fetchAsync,
            );

            // Assert
            expect<RunTimeFetchResponse>(response).toEqual({
                outcome: FETCH_OUTCOMES.FAILED,
                error: FETCH_REFUSALS.HOST_NOT_ALLOWED,
            });
            expect<boolean>(fetched).toBe(false);
        });
    });
});
