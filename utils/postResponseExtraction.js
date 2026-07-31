export const POST_RESPONSE_EXTRACTION_TIMEOUT_MS = 30_000;
export const POST_RESPONSE_EXTRACTION_JOIN_BUDGET_MS = 2_000;

/**
 * Stable, inexpensive fingerprint for a single rendered message body.
 * This is an identity guard, not a cryptographic digest.
 */
export function fingerprintPostResponseBody(text) {
    const value = String(text ?? '');
    let hash = 0x811c9dc5;

    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }

    return `${value.length}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function makePostResponseJobKey(snapshot) {
    if (!snapshot) return '';
    return JSON.stringify([
        String(snapshot.chatId ?? ''),
        Number(snapshot.messageId),
        Number(snapshot.swipeId),
    ]);
}

export function postResponseSnapshotsMatch(expected, current) {
    if (!expected || !current) return false;
    return expected.chatId === current.chatId
        && expected.messageId === current.messageId
        && expected.swipeId === current.swipeId
        && expected.bodyFingerprint === current.bodyFingerprint
        && expected.bodyText === current.bodyText
        && expected.messageRef === current.messageRef;
}

/**
 * Wait for a promise without cancelling it. The caller can continue while the
 * original work remains alive when the budget expires.
 */
export function waitForPostResponseJob(promise, timeoutMs = POST_RESPONSE_EXTRACTION_JOIN_BUDGET_MS) {
    const budget = Number(timeoutMs);
    if (!Number.isFinite(budget) || budget <= 0) {
        return Promise.resolve({ timedOut: true, value: undefined });
    }

    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            resolve({ timedOut: true, value: undefined });
        }, budget);

        Promise.resolve(promise).then(
            (value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve({ timedOut: false, value });
            },
            (error) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                reject(error);
            },
        );
    });
}
