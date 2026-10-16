import { BackgroundRefresh } from "./types/TabMessage";
import { hasPageAccessAsync, syncOptInContentScriptsAsync } from "./services/PageAccess";
import { isFetchRequest, isParseRequest } from "./WorkerRequestGuards";
import { SENDERS } from "./types/TabMessage";
import { HclParser } from "./services/HclParser";
import { fetchForContentScriptAsync } from "./services/WorkerFetch";
import { PARSE_OUTCOMES, ParseResponse } from "./types/ParseResponse";
import { logRecovered } from "./util/Log";
import { CONTENT_SCRIPT_FILE } from "./util/Constants";

// Session storage is closed to content scripts until the worker opens it.
chrome.storage.session
    .setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })
    .catch((error) => logRecovered("could not open session storage", { error }));

/** Injects the content script into a tab and asks it to link the page. */
const injectAndRefreshAsync = async (tabId: number): Promise<void> => {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId, allFrames: true },
            files: [CONTENT_SCRIPT_FILE],
        });
        const refresh: BackgroundRefresh = { sender: SENDERS.BACKGROUND };
        await chrome.tabs.sendMessage(tabId, refresh);
    } catch (error) {
        logRecovered("could not link the page in a tab", { error });
    }
};

syncOptInContentScriptsAsync().catch((error) =>
    logRecovered("could not register the content script on granted hosts", { error }),
);

chrome.permissions.onAdded.addListener(async (permissions) => {
    try {
        await syncOptInContentScriptsAsync();
        const origins = permissions.origins ?? [];
        const tabs = origins.length === 0 ? [] : await chrome.tabs.query({ url: origins });
        for (const tab of tabs) {
            if (tab.id !== undefined) {
                await injectAndRefreshAsync(tab.id);
            }
        }
    } catch (error) {
        logRecovered("could not link pages on a newly granted host", { error });
    }
});

chrome.permissions.onRemoved.addListener(() => {
    syncOptInContentScriptsAsync().catch((error) =>
        logRecovered("could not unregister the content script from a revoked host", { error }),
    );
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete" || tab.url === undefined) {
        return;
    }
    if (await hasPageAccessAsync(new URL(tab.url).hostname)) {
        await injectAndRefreshAsync(tabId);
    }
});

chrome.runtime.onMessage.addListener((request: unknown, sender, sendResponse) => {
    if (isParseRequest(request)) {
        HclParser.parseAsync(request.contents, request.fileName)
            .then((declarations) =>
                sendResponse({
                    outcome: PARSE_OUTCOMES.PARSED,
                    declarations: declarations,
                } satisfies ParseResponse),
            )
            .catch((error) =>
                sendResponse({
                    outcome: PARSE_OUTCOMES.FAILED,
                    error: String(error),
                } satisfies ParseResponse),
            );
        return true;
    }
    if (isFetchRequest(request)) {
        fetchForContentScriptAsync(request)
            .then(sendResponse)
            .catch((error) => logRecovered("could not answer a fetch request", { error }));
        return true;
    }
    // Not ours to answer, so the channel is not held open waiting for an answer.
    return false;
});
