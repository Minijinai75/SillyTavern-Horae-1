# Horae local verification assets

Status: verified on 26-07-31 (Asia/Taipei). The unit suite and SillyTavern 1.18.0 isolated runtime matrix below have been run successfully.

Requirements: Node.js 20+ and, for the examples, PowerShell 7. The assets have no package dependencies and do not require a root `package.json`.

## Unit suite

From the extension repository root:

```powershell
node --test .\tests\postResponseExtraction.test.mjs
```

The suite loads the browser ESM source through a `data:` URL, then covers deterministic body fingerprints, chat/message/swipe job-key isolation, snapshot identity/body/object-reference guards, and completed/timed-out/rejected joins.

## OpenAI-compatible mock

Start the server and append redacted NDJSON to the Windows temp directory:

```powershell
node .\tests\openai-mock-server.mjs `
  --port 43118 `
  --log "$env:TEMP\horae-openai-mock.ndjson"
```

Equivalent environment configuration:

```powershell
$env:HORAE_MOCK_HOST = "127.0.0.1"
$env:HORAE_MOCK_PORT = "43118"
$env:HORAE_MOCK_DELAY_MS = "750"
$env:HORAE_MOCK_LOG = "$env:TEMP\horae-openai-mock.ndjson"
node .\tests\openai-mock-server.mjs
```

Use these Auxiliary API values in Horae:

- API URL: `http://127.0.0.1:43118/v1`
- API key: any non-empty local fixture value
- Model: one of the IDs below

| Model | Response |
|---|---|
| `horae-success` | HTTP 200 with fixed, parseable `<horae>` and `<horaeevent>` blocks |
| `horae-delay` | Same fixture after `--delay-ms`; `horae-delay-2500` overrides it per request |
| `horae-hold` | Keeps the request pending until the release control endpoint is called |
| `horae-401` | OpenAI-shaped HTTP 401 |
| `horae-500` | OpenAI-shaped HTTP 500 |
| `horae-malformed` | HTTP 200 with invalid JSON, or invalid SSE when streaming |
| `horae-bad-tags` | Valid OpenAI completion whose content intentionally has no Horae tags |

`GET /v1/models` lists the fixtures. A request with `"stream": true` receives OpenAI-style SSE chunks followed by `data: [DONE]`.

Control endpoints:

```powershell
Invoke-RestMethod -Method Get  -Uri http://127.0.0.1:43118/healthz
Invoke-RestMethod -Method Get  -Uri http://127.0.0.1:43118/control/requests
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:43118/control/release
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:43118/control/reset
```

`reset` cancels held requests and clears in-memory history/counters. The NDJSON file remains append-only and receives a reset marker. Logs contain request bodies for prompt inspection, but recursively redact credential-shaped fields and bearer/key-shaped strings; request headers, including `Authorization`, are never logged. Story text can still be private, so keep the log outside the repository.

For the browser CORS fallback case, use a second port:

```powershell
node .\tests\openai-mock-server.mjs `
  --port 43119 `
  --no-cors `
  --log "$env:TEMP\horae-openai-no-cors.ndjson"
```

Point Horae at `http://127.0.0.1:43119/v1`. In a browser-hosted SillyTavern session, direct fetch should be blocked and Horae should retry through the SillyTavern 1.18 route-form proxy. Electron does not provide the same CORS test.

## SillyTavern 1.18 final matrix

These fixtures were used to run the isolated matrix without a paid model:

| Case | Setup and evidence |
|---|---|
| Default-off compatibility | Leave post-response extraction off; confirm upstream inline tags and no auxiliary post-response request |
| Success and persistence | Enable it with `horae-success`; confirm body renders first, fixture tags are written to the correct message/swipe, saved, and injected on the next turn |
| Slow auxiliary API | Use `horae-delay-2500`; confirm rendering is asynchronous and the next main turn waits no longer than the two-second join budget |
| Indefinite pending job | Use `horae-hold`; confirm the UI/main turn stays usable, then call `release` |
| Swipe/edit/chat races | Hold a request, change exactly one identity/body dimension, release it, and confirm stale output is discarded; repeat an edit between `MESSAGE_RECEIVED` and character render |
| Regenerate provenance | Exercise non-streaming delete-then-normal and explicit streaming regenerate, including a one-message `#0` chat; confirm the old global root state survives while the replaced floor data does not |
| Swipe deletion identity | Delete the current swipe, a later swipe, and the immediately preceding swipe where ST reports equal `{swipeId,newSwipeId}`; only the deleted version may be cancelled |
| Sidecar isolation | Generate a new swipe from a settled swipe, switch away before its queued extraction runs, then return; the new swipe must not inherit the old settlement |
| Explicit tag edit | While fresh extraction is queued, edit only the Horae tag blocks; confirm strict local reparse, no new auxiliary request, and durable swipe sidecar data |
| Historical boundary | Re-analyze an older floor after later summaries, table updates, RPG/stronghold changes, relationships, agenda, and location memory exist; inspect the mock prompt and confirm no later AI-derived state appears |
| Assistant filtering | Repeat around group narration, system/tool/function messages, and sideplay floors; only assistant narrative floors may schedule extraction |
| Failure without main fallback | Repeat with `horae-401`, `horae-500`, `horae-malformed`, and `horae-bad-tags`; confirm the body remains usable and no main-model extraction request appears |
| Browser proxy path | Run `--no-cors` and confirm fallback uses the SillyTavern 1.18 route-form proxy |
| Streaming compatibility | Send a manual `"stream": true` request and inspect SSE termination |
| Switch-off regression | Turn the feature off again and repeat the upstream generation/swipe/save/reload path |

Inspect the append-only request log after the matrix:

```powershell
Get-Content "$env:TEMP\horae-openai-mock.ndjson" |
  ForEach-Object { $_ | ConvertFrom-Json } |
  Select-Object seq, method, path, model, stream
```
