# Horae Minijin Fork Notes

> 狀態：Candidate Code Freeze — Pending Verification  
> 更新：26-07-31 05:11（Asia/Taipei）  
> 下一步：執行完整自動驗證、SillyTavern 1.18.0 實機矩陣與 Grok 獨立審計；驗證日期目前為「待最終驗證補登」。

## Repository lineage

- Fork repository: <https://github.com/Minijinai75/SillyTavern-Horae-1>
- Upstream repository: <https://github.com/SenriYuki/SillyTavern-Horae>
- Fork baseline: upstream `7a8859897bbfc6f0781ac5eb2451bc607e2bab95` (`7a88598`), Horae v1.15.1.
- First fork release: `1.15.1-minijin.1`.
- Git remotes:
  - `origin` → `https://github.com/Minijinai75/SillyTavern-Horae-1.git`
  - `upstream` → `https://github.com/SenriYuki/SillyTavern-Horae.git`

## Upstream sync strategy

1. Fetch `upstream` and compare `upstream/main` with the recorded baseline before changing fork code.
2. Read upstream changelog and inspect every conflict hotspot listed below.
3. Merge upstream into the fork without rewriting published `origin/main` history or force-pushing.
4. Keep fork-only behavior behind a default-off setting and resolve conflicts in favor of current upstream behavior when that setting is off.
5. After every upstream sync, rerun the complete validation and SillyTavern 1.18.0 device matrix before publishing a new fork release.
6. Record the new upstream commit in this file and the release changelog.

## Conflict hotspots

- `index.js`
  - `DEFAULT_SETTINGS`, settings migration, `PRESERVED_KEYS_ON_RESET`, and `_SETTINGS_EXPORT_KEYS`.
  - Auxiliary API routing, serial queue, prompt profiles, and direct API/CORS fetch.
  - `onPromptReady`, post-response message/render handlers, swipe/edit/chat-switch ownership, and tag writeback.
  - Public `VERSION` and exported profile metadata.
- `assets/templates/drawer.html`
  - Auxiliary API settings controls and mobile layout.
- `locales/*.json`
  - All post-response settings/toast keys must stay present in all six shipped locales.
- `manifest.json`, the three README files, `CHANGELOG.md`, and this file
  - Fork identity, version, install URL, verification status, and baseline commit.

## Fork behavior and boundaries

- `postResponseExtractionEnabled` is off by default.
- The setting reuses the existing Auxiliary API configuration. It does not introduce or export another credential set.
- `postResponseExtractionEnabled` is intentionally excluded from Horae config/profile export and character-card synchronization (`_SETTINGS_EXPORT_KEYS`). It is a local runtime/API-routing choice and must not be silently enabled by a shared profile.
- When enabled, the main prompt keeps memory data and recall but omits Horae output instructions. The Auxiliary API performs post-response extraction asynchronously.
- Failure in this path never falls back to the main API. Manual per-message AI analysis remains the retry path.
- A matching pending extraction may be joined for at most 2 seconds before the next main request proceeds.
- Preparation, historical-context capture, Auxiliary API work, and writeback share one serialized transaction queue. Request timeout begins only after dequeue.
- Writeback is guarded by chat, floor, swipe, narrative, target-meta, and historical-context fingerprints. Deferred chat work resumes only when every stored version still matches.
- Historical re-extraction rebuilds location memory, relationships, agenda, and RPG state only from sources before the target floor plus explicit user provenance.
- Swipe settlement uses per-swipe sidecar storage for pristine greetings. Overswipe failure preserves the old state; swipe deletion either remaps the pending version or waits for the host's following `MESSAGE_SWIPED`.
- The mode can only be enabled locally with a complete Auxiliary API configuration. Shared profiles, character cards, external raw settings, and exported configuration cannot silently enable it.

## Compatibility notes

- Target host for this release: SillyTavern 1.18.0.
- The CORS fallback path is corrected from the obsolete query form to the SillyTavern 1.18.0 route form: `/proxy/${encodeURIComponent(url)}`.
- Public Port API context uses a filtered facade and does not expose Horae/ST credential containers.
- The upstream `event_types.MESSAGE_RENDERED` registration is known to be dead under SillyTavern 1.18.0 and is deliberately **not** repaired in this fork release; it is outside the post-response extraction patch.
- Verification status remains Pending Verification until the complete implementation is finished and tested together.

## Authorship and licensing

- Original author attribution remains **SenriYuki**.
- Fork maintainer is **Minijinai75**.
- The upstream baseline contains no `LICENSE` file. This fork does not invent, replace, or imply a license, and no original authorship is claimed by the fork maintainer.

## Versioning rule

- Fork releases use `<upstream-version>-minijin.<n>`.
- Increment `<n>` for fork-only releases on the same upstream baseline.
- When rebasing or merging a new upstream release, adopt that upstream version and restart at `-minijin.1`.
- `manifest.json`, the `VERSION` constant, README headings/examples, changelog, and this file must carry the same release version before publishing.
