import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(testDirectory, '..', 'utils', 'postResponseExtraction.js');
const sourceText = await readFile(sourcePath, 'utf8');

// The extension is browser ESM, but this repository intentionally has no
// package.json with "type": "module". A data URL keeps the production source
// untouched while making Node interpret this one file as ESM.
const browserModuleUrl = `data:text/javascript;base64,${
    Buffer.from(
        `${sourceText}\n//# sourceURL=${pathToFileURL(sourcePath).href}\n`,
        'utf8',
    ).toString('base64')
}`;

const {
    fingerprintPostResponseBody,
    makePostResponseJobKey,
    postResponseSnapshotsMatch,
    waitForPostResponseJob,
} = await import(browserModuleUrl);

test('fingerprints are deterministic and preserve exact body distinctions', () => {
    assert.equal(fingerprintPostResponseBody(null), '0:811c9dc5');
    assert.equal(fingerprintPostResponseBody('hello'), '5:4f9f2cab');
    assert.equal(
        fingerprintPostResponseBody('hello'),
        fingerprintPostResponseBody('hello'),
    );
    assert.equal(
        fingerprintPostResponseBody(42),
        fingerprintPostResponseBody('42'),
    );
    assert.notEqual(
        fingerprintPostResponseBody('hello'),
        fingerprintPostResponseBody('Hello'),
    );
    assert.notEqual(
        fingerprintPostResponseBody('line one\nline two'),
        fingerprintPostResponseBody('line one\r\nline two'),
    );
});

test('job keys isolate chat, message, and swipe identity', () => {
    const base = { chatId: 'chat-a', messageId: 17, swipeId: 0 };
    const keys = [
        makePostResponseJobKey(base),
        makePostResponseJobKey({ ...base, chatId: 'chat-b' }),
        makePostResponseJobKey({ ...base, messageId: 18 }),
        makePostResponseJobKey({ ...base, swipeId: 1 }),
    ];

    assert.equal(keys[0], '["chat-a",17,0]');
    assert.equal(new Set(keys).size, keys.length);
});

test('snapshots match only the same chat, message, and swipe identity', () => {
    const messageRef = { mes: 'rendered body' };
    const expected = {
        chatId: 'chat-a',
        messageId: 17,
        swipeId: 2,
        bodyText: 'rendered body',
        bodyFingerprint: '13:01234567',
        messageRef,
    };

    assert.equal(postResponseSnapshotsMatch(expected, { ...expected }), true);
    assert.equal(
        postResponseSnapshotsMatch(expected, { ...expected, chatId: 'chat-b' }),
        false,
    );
    assert.equal(
        postResponseSnapshotsMatch(expected, { ...expected, messageId: 18 }),
        false,
    );
    assert.equal(
        postResponseSnapshotsMatch(expected, { ...expected, swipeId: 3 }),
        false,
    );
    assert.equal(postResponseSnapshotsMatch(null, expected), false);
    assert.equal(postResponseSnapshotsMatch(expected, null), false);
});

test('snapshots reject changed bodies and replacement message objects', () => {
    const messageRef = { mes: 'rendered body' };
    const expected = {
        chatId: 'chat-a',
        messageId: 17,
        swipeId: 2,
        bodyText: 'rendered body',
        bodyFingerprint: '13:01234567',
        messageRef,
    };

    assert.equal(
        postResponseSnapshotsMatch(expected, {
            ...expected,
            bodyFingerprint: '14:89abcdef',
        }),
        false,
    );
    assert.equal(
        postResponseSnapshotsMatch(expected, {
            ...expected,
            bodyText: 'different body',
        }),
        false,
    );
    assert.equal(
        postResponseSnapshotsMatch(expected, {
            ...expected,
            messageRef: { mes: 'rendered body' },
        }),
        false,
    );
});

test('waitForPostResponseJob returns a completed value within budget', async () => {
    const completed = { status: 'completed', messageId: 17 };

    assert.deepEqual(
        await waitForPostResponseJob(Promise.resolve(completed), 100),
        { timedOut: false, value: completed },
    );
});

test('waitForPostResponseJob times out without requiring the job to settle', {
    timeout: 1_000,
}, async () => {
    const neverSettles = new Promise(() => {});

    assert.deepEqual(
        await waitForPostResponseJob(neverSettles, 10),
        { timedOut: true, value: undefined },
    );
});

test('waitForPostResponseJob preserves job rejection', async () => {
    const failure = new Error('auxiliary extraction failed');

    await assert.rejects(
        waitForPostResponseJob(Promise.reject(failure), 100),
        error => error === failure,
    );
});
