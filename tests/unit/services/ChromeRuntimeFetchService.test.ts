import { expect } from "@jest/globals";
import { WORKER_QUERIES } from "../../../src/types/WorkerRequest";
import { ChromeRuntimeFetchService } from "../../../src/data-access/ChromeRuntimeFetchService";
import { FETCH_OUTCOMES, RunTimeFetchResponse } from "../../../src/types/RunTimeFetchResponse";
import { clearChromeRuntime, stubChromeRuntime } from "./ChromeRuntimeStub";

const PORT_CLOSED = { message: "The message port closed before a response was received." };

const answered: RunTimeFetchResponse = {
    outcome: FETCH_OUTCOMES.OK,
    data: { versions: ["1.0.0"] },
};

const service = new ChromeRuntimeFetchService();
const URL_UNDER_TEST = "https://registry.terraform.io/v1/providers/hashicorp/aws";

afterEach(() => clearChromeRuntime());

describe("Given the background script answers", () => {
    describe("When data is fetched", () => {
        test("Then I expect the response passed through", async () => {
            // Arrange
            stubChromeRuntime(() => answered);

            // Act
            const response = await service.fetchDataAsync(URL_UNDER_TEST);

            // Assert
            expect<RunTimeFetchResponse>(response).toEqual(answered);
        });
    });

    describe("When the registry answered with a non ok status", () => {
        test("Then I expect the rejection and its status passed through", async () => {
            // Arrange
            const notFound: RunTimeFetchResponse = {
                outcome: FETCH_OUTCOMES.REJECTED,
                status: 404,
            };
            stubChromeRuntime(() => notFound);

            // Act
            const response = await service.fetchDataAsync(URL_UNDER_TEST);

            // Assert
            expect<RunTimeFetchResponse>(response).toEqual(notFound);
        });
    });

    describe("When the fetch failed in the background script", () => {
        test("Then I expect the failure and its reason passed through", async () => {
            // Arrange
            const failed: RunTimeFetchResponse = {
                outcome: FETCH_OUTCOMES.FAILED,
                error: "Host not allowed",
            };
            stubChromeRuntime(() => failed);

            // Act
            const response = await service.fetchDataAsync(URL_UNDER_TEST);

            // Assert
            expect<RunTimeFetchResponse>(response).toEqual(failed);
        });
    });

    describe("When a cache mode is named", () => {
        test("Then I expect the url and the mode carried in the message", async () => {
            // Arrange
            const stub = stubChromeRuntime(() => answered);

            // Act
            await service.fetchDataAsync(URL_UNDER_TEST, "force-cache");

            // Assert
            expect<unknown>(stub.sent[0]).toEqual({
                contentScriptQuery: WORKER_QUERIES.FETCH,
                url: URL_UNDER_TEST,
                cache: "force-cache",
            });
        });
    });
});

describe("Given the background script goes away before answering", () => {
    describe("When data is fetched", () => {
        test("Then I expect a failed response rather than undefined", async () => {
            // Arrange
            stubChromeRuntime(() => undefined);

            // Act
            const response = await service.fetchDataAsync(URL_UNDER_TEST);

            // Assert
            expect<RunTimeFetchResponse>(response).toEqual({
                outcome: FETCH_OUTCOMES.FAILED,
                error: "the background script did not respond",
            });
        });

        test("Then I expect the reason chrome reports carried in the failure", async () => {
            // Arrange
            stubChromeRuntime(() => undefined, PORT_CLOSED);

            // Act
            const response = await service.fetchDataAsync(URL_UNDER_TEST);

            // Assert
            expect<RunTimeFetchResponse>(response).toEqual({
                outcome: FETCH_OUTCOMES.FAILED,
                error: `the background script did not respond: ${PORT_CLOSED.message}`,
            });
        });
    });
});

describe("Given the background script answers with something that is not a response", () => {
    describe("When data is fetched", () => {
        test("Then I expect each read as a failed response naming a bad answer, not silence", async () => {
            // Arrange
            const answers: unknown[] = [
                { ok: true, status: 200, statusText: "", headers: {}, data: {} },
                { outcome: FETCH_OUTCOMES.OK },
                { outcome: FETCH_OUTCOMES.REJECTED, status: "404" },
                { outcome: FETCH_OUTCOMES.FAILED },
                FETCH_OUTCOMES.OK,
            ];

            // Act
            const responses: RunTimeFetchResponse[] = [];
            for (const answer of answers) {
                stubChromeRuntime(() => answer);
                responses.push(await service.fetchDataAsync(URL_UNDER_TEST));
            }

            // Assert
            expect<RunTimeFetchResponse[]>(responses).toEqual(
                answers.map(() => ({
                    outcome: FETCH_OUTCOMES.FAILED,
                    error: "the background script answered with something that is not a fetch response",
                })),
            );
        });
    });
});
