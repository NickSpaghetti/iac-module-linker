import { isSupportedPageHost } from "./util/PageHosts";
import { BackgroundRefresh, PopupRequest, SENDERS, TabMessage } from "./types/TabMessage";
import { Nullable } from "./types/Nullable";
import { hasField, readString } from "./util/Fields";

type Sender = (typeof SENDERS)[keyof typeof SENDERS];

/**
 * Determines whether a message is a tab message.
 * @param message The message to test.
 * @returns true if message is a TabMessage; otherwise, false.
 */
export const isTabMessage = (message: unknown): message is TabMessage => {
    const sender = readSender(message);
    if (sender === SENDERS.BACKGROUND) {
        return true;
    }
    return (
        sender === SENDERS.POPUP &&
        hasField(message, "tabId") &&
        typeof message.tabId === "number" &&
        readTabUrl(message) !== null
    );
};

/**
 * Determines whether the content script should act on a message.
 * @param message The message to test.
 * @returns true if it is a refresh, or a popup request for a supported host; otherwise, false.
 */
export const shouldHandleMessage = (message: unknown): boolean =>
    isTabMessage(message) &&
    (message.sender === SENDERS.BACKGROUND || isSupportedTabUrl(message.tabUrl));

/**
 * Determines whether the background script sent a message.
 * @param message The message to test.
 * @returns true if it did, which means refresh; otherwise, false.
 */
export const isBackgroundRefresh = (message: unknown): message is BackgroundRefresh =>
    readSender(message) === SENDERS.BACKGROUND;

/**
 * Reads the tab url a message names.
 * @param message The message to read.
 * @returns The tab url, or null when the message names none.
 */
export const readTabUrl = (message: unknown): Nullable<string> =>
    readString<PopupRequest>(message, "tabUrl");

/**
 * @param tabUrl The url the popup says it is asking about.
 * @returns true if its host is a supported page host exactly and not a lookalike; otherwise, false.
 */
export const isSupportedTabUrl = (tabUrl: string): boolean => {
    try {
        return isSupportedPageHost(new URL(tabUrl).hostname);
    } catch {
        return false;
    }
};

/** Reads a known sender from a message, or "" when there is none. */
const readSender = (message: unknown): Sender | "" => {
    if (!hasField(message, "sender")) {
        return "";
    }
    return message.sender === SENDERS.BACKGROUND || message.sender === SENDERS.POPUP
        ? message.sender
        : "";
};
