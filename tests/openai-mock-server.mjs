import {
    appendFileSync,
    mkdirSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 43_118;
const DEFAULT_DELAY_MS = 750;
const MAX_DELAY_MS = 300_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const HISTORY_LIMIT = 200;
const FIXTURE_NAME = 'horae-deterministic-v1';

const HORAE_FIXTURE_TAGS = `<horae>
time:2026/07/31 03:00
location:Horae 測試室入口
scene_desc:入口有固定的銀色門框與藍色識別燈。
location:Horae 測試室
scene_desc:室內中央固定擺放一張測試桌，北牆設有觀測窗。
atmosphere:穩定且可重現
characters:測試角色
costume:測試角色=藍色測試外套
item:🧭測試羅盤|deterministic-fixture=測試角色@測試桌面
npc:測試研究員|黑色短髮/銀框眼鏡=冷靜細心@測試協作者~性別:女~年齡:28~種族:人類~職業:研究員~補充:固定測試資料
</horae>
<horaeevent>
event:一般|測試角色在固定測試室取得羅盤，供回覆後結算流程驗證使用。
</horaeevent>`;

const BAD_TAG_FIXTURE = 'This intentionally valid completion contains no Horae tags.';

function printHelp() {
    process.stdout.write(`Horae local OpenAI-compatible mock server (Node 20+)

Usage:
  node tests/openai-mock-server.mjs [options]

Options:
  --host HOST       Bind address (default: ${DEFAULT_HOST})
  --port PORT       TCP port; 0 chooses a free port (default: ${DEFAULT_PORT})
  --delay-ms MS     Delay used by model "horae-delay" (default: ${DEFAULT_DELAY_MS})
  --log PATH        Append redacted NDJSON to PATH; "-" means stdout (default: -)
  --no-cors         Omit all Access-Control-Allow-* response headers
  --cors            Force CORS headers on, overriding HORAE_MOCK_NO_CORS
  --help            Show this help

Environment:
  HORAE_MOCK_HOST, HORAE_MOCK_PORT, HORAE_MOCK_DELAY_MS,
  HORAE_MOCK_LOG, HORAE_MOCK_NO_CORS

Models:
  horae-success, horae-delay[-MS], horae-hold, horae-401,
  horae-500, horae-malformed, horae-bad-tags
`);
}

function envFlag(value) {
    return /^(1|true|yes|on)$/i.test(String(value ?? '').trim());
}

function parseInteger(name, value, minimum, maximum) {
    if (!/^\d+$/.test(String(value ?? ''))) {
        throw new Error(`${name} must be an integer`);
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
        throw new Error(`${name} must be between ${minimum} and ${maximum}`);
    }
    return parsed;
}

function parseOptions(argv) {
    const options = {
        host: process.env.HORAE_MOCK_HOST || DEFAULT_HOST,
        port: parseInteger(
            'HORAE_MOCK_PORT',
            process.env.HORAE_MOCK_PORT || DEFAULT_PORT,
            0,
            65_535,
        ),
        delayMs: parseInteger(
            'HORAE_MOCK_DELAY_MS',
            process.env.HORAE_MOCK_DELAY_MS || DEFAULT_DELAY_MS,
            0,
            MAX_DELAY_MS,
        ),
        logTarget: process.env.HORAE_MOCK_LOG || '-',
        cors: !envFlag(process.env.HORAE_MOCK_NO_CORS),
        help: false,
    };

    for (let index = 0; index < argv.length; index++) {
        const argument = argv[index];
        if (argument === '--help' || argument === '-h') {
            options.help = true;
            continue;
        }
        if (argument === '--no-cors') {
            options.cors = false;
            continue;
        }
        if (argument === '--cors') {
            options.cors = true;
            continue;
        }

        const separatorIndex = argument.indexOf('=');
        const name = separatorIndex >= 0
            ? argument.slice(0, separatorIndex)
            : argument;
        let value = separatorIndex >= 0
            ? argument.slice(separatorIndex + 1)
            : undefined;

        if (['--host', '--port', '--delay-ms', '--log'].includes(name)) {
            if (value === undefined) {
                value = argv[++index];
            }
            if (value === undefined || value === '') {
                throw new Error(`${name} requires a value`);
            }
        }

        if (name === '--host') {
            options.host = value;
        } else if (name === '--port') {
            options.port = parseInteger('--port', value, 0, 65_535);
        } else if (name === '--delay-ms') {
            options.delayMs = parseInteger('--delay-ms', value, 0, MAX_DELAY_MS);
        } else if (name === '--log') {
            options.logTarget = value;
        } else {
            throw new Error(`unknown option: ${argument}`);
        }
    }

    return options;
}

function createNdjsonLogger(target) {
    if (!target || target === '-') {
        return {
            target: 'stdout',
            write(record) {
                process.stdout.write(`${JSON.stringify(record)}\n`);
            },
            close() {},
        };
    }

    const filePath = resolve(target);
    mkdirSync(dirname(filePath), { recursive: true });
    appendFileSync(filePath, '', 'utf8');

    return {
        target: filePath,
        write(record) {
            appendFileSync(filePath, `${JSON.stringify(record)}\n`, 'utf8');
        },
        close() {},
    };
}

function isSensitiveKey(key) {
    const normalized = String(key).toLowerCase().replace(/[^a-z0-9]/g, '');
    return [
        'authorization',
        'proxyauthorization',
        'apikey',
        'token',
        'accesstoken',
        'refreshtoken',
        'secret',
        'password',
        'credential',
        'cookie',
        'setcookie',
    ].includes(normalized)
        || normalized.endsWith('apikey')
        || normalized.endsWith('secret')
        || normalized.endsWith('password');
}

function redactString(value) {
    return String(value)
        .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
        .replace(/\bsk-[A-Za-z0-9_-]{6,}\b/g, 'sk-[REDACTED]');
}

function redact(value, key = '') {
    if (isSensitiveKey(key)) return '[REDACTED]';
    if (typeof value === 'string') return redactString(value);
    if (Array.isArray(value)) return value.map(item => redact(item));
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([entryKey, entryValue]) => [
                entryKey,
                redact(entryValue, entryKey),
            ]),
        );
    }
    return value;
}

function applyCors(request, response, enabled) {
    if (!enabled) return;
    const origin = request.headers.origin;
    response.setHeader('Access-Control-Allow-Origin', origin || '*');
    if (origin) response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.setHeader('Access-Control-Expose-Headers', 'X-Horae-Fixture');
    response.setHeader('Access-Control-Max-Age', '600');
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    for (const [name, value] of Object.entries(extraHeaders)) {
        response.setHeader(name, value);
    }
    response.end(`${JSON.stringify(payload)}\n`);
}

function sendOpenAiError(response, statusCode, code, message) {
    sendJson(response, statusCode, {
        error: {
            message,
            type: statusCode === 401 ? 'authentication_error' : 'server_error',
            param: null,
            code,
        },
    }, {
        'X-Horae-Fixture': FIXTURE_NAME,
    });
}

function readRequestBody(request) {
    return new Promise((resolveBody, rejectBody) => {
        const chunks = [];
        let size = 0;
        let tooLarge = false;

        request.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                tooLarge = true;
                chunks.length = 0;
                return;
            }
            if (!tooLarge) chunks.push(chunk);
        });
        request.on('end', () => {
            if (tooLarge) {
                const error = new Error(`request body exceeds ${MAX_BODY_BYTES} bytes`);
                error.statusCode = 413;
                rejectBody(error);
                return;
            }
            resolveBody(Buffer.concat(chunks).toString('utf8'));
        });
        request.on('aborted', () => {
            const error = new Error('request aborted');
            error.statusCode = 400;
            rejectBody(error);
        });
        request.on('error', rejectBody);
    });
}

function classifyModel(model, defaultDelayMs) {
    if (model === 'horae-success') return { kind: 'success' };
    if (model === 'horae-hold') return { kind: 'hold' };
    if (model === 'horae-401') return { kind: '401' };
    if (model === 'horae-500') return { kind: '500' };
    if (model === 'horae-malformed') return { kind: 'malformed' };
    if (model === 'horae-bad-tags') return { kind: 'bad-tags' };

    const delayMatch = /^horae-delay(?:-(\d+))?$/.exec(model);
    if (delayMatch) {
        return {
            kind: 'delay',
            delayMs: delayMatch[1]
                ? Math.min(Number(delayMatch[1]), MAX_DELAY_MS)
                : defaultDelayMs,
        };
    }
    return { kind: 'unknown' };
}

function completionEnvelope(model, responseSequence, content = HORAE_FIXTURE_TAGS) {
    return {
        id: `chatcmpl-horae-${String(responseSequence).padStart(6, '0')}`,
        object: 'chat.completion',
        created: 0,
        model,
        choices: [{
            index: 0,
            message: {
                role: 'assistant',
                content,
            },
            logprobs: null,
            finish_reason: 'stop',
        }],
        usage: {
            prompt_tokens: 11,
            completion_tokens: 29,
            total_tokens: 40,
        },
        system_fingerprint: FIXTURE_NAME,
    };
}

function writeSseEvent(response, payload) {
    response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function sendStreamingFixture(response, model, responseSequence, content) {
    const id = `chatcmpl-horae-${String(responseSequence).padStart(6, '0')}`;
    response.statusCode = 200;
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.setHeader('X-Horae-Fixture', FIXTURE_NAME);
    response.flushHeaders?.();

    writeSseEvent(response, {
        id,
        object: 'chat.completion.chunk',
        created: 0,
        model,
        choices: [{
            index: 0,
            delta: { role: 'assistant', content: '' },
            finish_reason: null,
        }],
        system_fingerprint: FIXTURE_NAME,
    });

    const chunks = content.match(/[\s\S]{1,96}/g) || [''];
    for (const chunk of chunks) {
        writeSseEvent(response, {
            id,
            object: 'chat.completion.chunk',
            created: 0,
            model,
            choices: [{
                index: 0,
                delta: { content: chunk },
                finish_reason: null,
            }],
            system_fingerprint: FIXTURE_NAME,
        });
    }

    writeSseEvent(response, {
        id,
        object: 'chat.completion.chunk',
        created: 0,
        model,
        choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop',
        }],
        system_fingerprint: FIXTURE_NAME,
    });
    response.end('data: [DONE]\n\n');
}

function sendMalformedFixture(response, stream) {
    response.statusCode = 200;
    response.setHeader(
        'Content-Type',
        stream ? 'text/event-stream; charset=utf-8' : 'application/json; charset=utf-8',
    );
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Horae-Fixture', `${FIXTURE_NAME}-malformed`);
    response.end(stream
        ? 'data: {"broken":\n\ndata: [DONE]\n\n'
        : '{"broken":');
}

function createState(options, logger) {
    return {
        options,
        logger,
        startedAt: new Date().toISOString(),
        address: null,
        requestSequence: 0,
        responseSequence: 0,
        completionRequests: 0,
        completedResponses: 0,
        heldSequence: 0,
        heldRequests: new Map(),
        history: [],
    };
}

function recordRequest(state, request, requestUrl, body) {
    const sequence = ++state.requestSequence;
    const safeBody = redact(body);
    const record = {
        type: 'request',
        at: new Date().toISOString(),
        seq: sequence,
        method: request.method || 'GET',
        path: requestUrl.pathname,
        origin: request.headers.origin || null,
        model: typeof body?.model === 'string' ? body.model : null,
        stream: body?.stream === true,
        body: safeBody,
    };

    // Header logging is deliberately allow-list-free: Authorization is never
    // copied into a record, even in redacted form.
    state.history.push(record);
    if (state.history.length > HISTORY_LIMIT) state.history.shift();
    state.logger.write(record);
    return sequence;
}

function sendCompletion(state, response, model, stream, content = HORAE_FIXTURE_TAGS) {
    if (response.destroyed || response.writableEnded) return false;
    const responseSequence = ++state.responseSequence;
    state.completedResponses++;
    if (stream) {
        sendStreamingFixture(response, model, responseSequence, content);
    } else {
        sendJson(
            response,
            200,
            completionEnvelope(model, responseSequence, content),
            { 'X-Horae-Fixture': FIXTURE_NAME },
        );
    }
    return true;
}

function holdCompletion(state, response, model, stream) {
    const holdId = `hold-${++state.heldSequence}`;
    const held = { holdId, response, model, stream };
    state.heldRequests.set(holdId, held);
    response.once('close', () => {
        state.heldRequests.delete(holdId);
    });
    return holdId;
}

function releaseHeldRequests(state) {
    let released = 0;
    for (const [holdId, held] of [...state.heldRequests]) {
        state.heldRequests.delete(holdId);
        if (sendCompletion(
            state,
            held.response,
            held.model,
            held.stream,
        )) {
            released++;
        }
    }
    return released;
}

function cancelHeldRequests(state, reason) {
    let cancelled = 0;
    for (const [holdId, held] of [...state.heldRequests]) {
        state.heldRequests.delete(holdId);
        if (held.response.destroyed || held.response.writableEnded) continue;
        sendOpenAiError(held.response, 503, 'horae_mock_reset', reason);
        cancelled++;
    }
    return cancelled;
}

function modelsPayload(options) {
    const ids = [
        'horae-success',
        'horae-delay',
        `horae-delay-${options.delayMs}`,
        'horae-hold',
        'horae-401',
        'horae-500',
        'horae-malformed',
        'horae-bad-tags',
    ];
    return {
        object: 'list',
        data: [...new Set(ids)].map(id => ({
            id,
            object: 'model',
            created: 0,
            owned_by: 'horae-local-fixture',
        })),
    };
}

function healthPayload(state) {
    return {
        ok: true,
        fixture: FIXTURE_NAME,
        startedAt: state.startedAt,
        address: state.address,
        cors: state.options.cors,
        logTarget: state.logger.target,
        requests: state.requestSequence,
        completionRequests: state.completionRequests,
        completedResponses: state.completedResponses,
        heldRequests: state.heldRequests.size,
    };
}

function createRequestHandler(state) {
    return async (request, response) => {
        applyCors(request, response, state.options.cors);
        response.setHeader('Cache-Control', 'no-store');

        const requestUrl = new URL(request.url || '/', 'http://localhost');
        let rawBody = '';
        let body = null;

        try {
            if (['POST', 'PUT', 'PATCH'].includes(request.method || '')) {
                rawBody = await readRequestBody(request);
                if (rawBody.trim()) {
                    try {
                        body = JSON.parse(rawBody);
                    } catch {
                        recordRequest(state, request, requestUrl, {
                            malformedJson: '[REDACTED INVALID JSON]',
                        });
                        sendOpenAiError(
                            response,
                            400,
                            'invalid_json',
                            'Request body is not valid JSON',
                        );
                        return;
                    }
                }
            }

            recordRequest(state, request, requestUrl, body);

            if (request.method === 'OPTIONS') {
                response.statusCode = 204;
                response.end();
                return;
            }

            if (request.method === 'GET' && requestUrl.pathname === '/healthz') {
                sendJson(response, 200, healthPayload(state), {
                    'X-Horae-Fixture': FIXTURE_NAME,
                });
                return;
            }

            if (request.method === 'GET' && requestUrl.pathname === '/v1/models') {
                sendJson(response, 200, modelsPayload(state.options), {
                    'X-Horae-Fixture': FIXTURE_NAME,
                });
                return;
            }

            if (request.method === 'GET' && requestUrl.pathname === '/control/requests') {
                sendJson(response, 200, {
                    object: 'list',
                    data: state.history,
                });
                return;
            }

            if (request.method === 'POST' && requestUrl.pathname === '/control/release') {
                const released = releaseHeldRequests(state);
                state.logger.write({
                    type: 'control.release',
                    at: new Date().toISOString(),
                    released,
                });
                sendJson(response, 200, {
                    ok: true,
                    released,
                    heldRequests: state.heldRequests.size,
                });
                return;
            }

            if (request.method === 'POST' && requestUrl.pathname === '/control/reset') {
                const cancelled = cancelHeldRequests(
                    state,
                    'Held request cancelled by mock reset',
                );
                state.requestSequence = 0;
                state.responseSequence = 0;
                state.completionRequests = 0;
                state.completedResponses = 0;
                state.heldSequence = 0;
                state.history.length = 0;
                state.logger.write({
                    type: 'control.reset',
                    at: new Date().toISOString(),
                    cancelled,
                });
                sendJson(response, 200, {
                    ok: true,
                    cancelled,
                    note: 'In-memory history and counters reset; NDJSON remains append-only.',
                });
                return;
            }

            if (
                request.method === 'POST'
                && requestUrl.pathname === '/v1/chat/completions'
            ) {
                state.completionRequests++;
                if (!body || typeof body !== 'object' || Array.isArray(body)) {
                    sendOpenAiError(
                        response,
                        400,
                        'invalid_request_body',
                        'Expected a JSON object request body',
                    );
                    return;
                }

                const model = String(body.model || '');
                const stream = body.stream === true;
                const scenario = classifyModel(model, state.options.delayMs);

                if (scenario.kind === 'unknown') {
                    sendOpenAiError(
                        response,
                        404,
                        'model_not_found',
                        `Unknown mock model: ${model || '(empty)'}`,
                    );
                    return;
                }
                if (scenario.kind === '401') {
                    sendOpenAiError(
                        response,
                        401,
                        'invalid_api_key',
                        'Deterministic mock authentication failure',
                    );
                    return;
                }
                if (scenario.kind === '500') {
                    sendOpenAiError(
                        response,
                        500,
                        'horae_mock_internal_error',
                        'Deterministic mock server failure',
                    );
                    return;
                }
                if (scenario.kind === 'malformed') {
                    sendMalformedFixture(response, stream);
                    return;
                }
                if (scenario.kind === 'bad-tags') {
                    sendCompletion(state, response, model, stream, BAD_TAG_FIXTURE);
                    return;
                }
                if (scenario.kind === 'hold') {
                    holdCompletion(state, response, model, stream);
                    return;
                }
                if (scenario.kind === 'delay') {
                    setTimeout(() => {
                        sendCompletion(state, response, model, stream);
                    }, scenario.delayMs);
                    return;
                }

                sendCompletion(state, response, model, stream);
                return;
            }

            sendJson(response, 404, {
                error: {
                    message: `${request.method || 'GET'} ${requestUrl.pathname} not found`,
                    type: 'invalid_request_error',
                    param: null,
                    code: 'route_not_found',
                },
            });
        } catch (error) {
            if (response.destroyed || response.writableEnded) return;
            const statusCode = Number(error?.statusCode) || 500;
            sendOpenAiError(
                response,
                statusCode,
                statusCode === 413 ? 'request_too_large' : 'mock_server_error',
                error?.message || String(error),
            );
        }
    };
}

function listen(server, port, host) {
    return new Promise((resolveListen, rejectListen) => {
        const onError = error => rejectListen(error);
        server.once('error', onError);
        server.listen(port, host, () => {
            server.off('error', onError);
            resolveListen();
        });
    });
}

async function main() {
    const options = parseOptions(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    const logger = createNdjsonLogger(options.logTarget);
    const state = createState(options, logger);
    const server = createServer(createRequestHandler(state));

    await listen(server, options.port, options.host);
    const address = server.address();
    state.address = typeof address === 'object' && address
        ? { address: address.address, family: address.family, port: address.port }
        : address;

    const displayHost = options.host.includes(':')
        ? `[${options.host}]`
        : options.host;
    const displayPort = typeof address === 'object' && address
        ? address.port
        : options.port;
    console.error(
        `[horae-mock] listening on http://${displayHost}:${displayPort} `
        + `(CORS ${options.cors ? 'on' : 'off'}, NDJSON ${logger.target})`,
    );

    let shuttingDown = false;
    const shutdown = signal => {
        if (shuttingDown) return;
        shuttingDown = true;
        const cancelled = cancelHeldRequests(
            state,
            `Mock server shutting down (${signal})`,
        );
        logger.write({
            type: 'server.stop',
            at: new Date().toISOString(),
            signal,
            cancelled,
        });
        server.close(() => {
            logger.close();
            process.exit(0);
        });
        setTimeout(() => process.exit(1), 2_000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch(error => {
    console.error(`[horae-mock] ${error?.stack || error}`);
    process.exitCode = 1;
});
