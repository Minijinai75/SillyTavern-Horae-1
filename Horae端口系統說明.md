# Horae 端口系統說明

## 系統定義

Horae Port 是 Horae 自帶的前端掛載層。第三方擴充功能、預設腳本、狀態欄作者可以在不修改 Horae 原始碼的前提下，向固定插槽註冊自己的 UI 元件。

端口只承擔展示與互動。資料來源由呼叫方決定：可以直接讀 Horae 自身的狀態（時間線、地點、角色、物品、關係、RPG 模板等），也可以透過自訂資料源從其他擴充功能、使用者腳本、外部介面取得資料，再交給端口渲染。

常見用途：

- 給 Horae 抽屜新增一個分頁
- 在每條訊息面板裡加入自訂資訊塊
- 在底部欄放一個全域 HUD
- 把外部擴充功能的狀態值與 Horae 狀態組合在一起渲染

---

## 核心 API

```javascript
window.Horae.portApiVersion           // 端口協議版本號，整數
window.Horae.slots                    // 目前支援的插槽 ID 列表

window.Horae.registerPort(definition)
window.Horae.unregisterPort(id)
window.Horae.refreshPorts(scope?)
window.Horae.getPorts()

window.Horae.registerDataProvider(id, provider)
window.Horae.unregisterDataProvider(id)
window.Horae.getDataProviderIds()
```

`registerPort` 與 `registerDataProvider` 都回傳一個 `unregister()` 函式，呼叫即可解除註冊。

Horae 不會預裝任何外部資料源，所有 Provider 都需要呼叫方自行註冊。

### 兼容性檢查

端口協議如有破壞性變更會遞增 `portApiVersion`。第三方擴充功能建議在加載時先檢查：

```javascript
if (!window.Horae || (window.Horae.portApiVersion ?? 0) < 1) {
    console.warn('[my-plugin] 目前 Horae 版本不支援端口協議 v1，已跳過註冊。');
    return;
}
```

---

## 可用插槽

| 插槽 ID          | 位置                                            | 適用場景                                |
| ---------------- | ----------------------------------------------- | --------------------------------------- |
| `bottom-bar`     | 聊天輸入區上方（找不到則改放到螢幕底部）        | 全域 HUD、目前位置、資源條、快捷操作    |
| `status`         | Horae 抽屜「狀態」頁底部                        | 目前世界狀態摘要、附加狀態卡片          |
| `drawer-tab`     | Horae 抽屜新增標籤頁                            | 復雜介面，例如完整資料瀏覽器            |
| `message-panel`  | 每條訊息的 Horae 元資料面板內部                 | 樓層級附加資訊、單條記錄的擴充欄位      |
| `rpg-hud`        | 每條訊息上方的 RPG HUD 內部                     | RPG 模式下的擴充狀態條、Buff、裝備摘要  |

`bottom-bar` 優先掛在 `#form_sheld` / `#send_form` / `#sheld` 的父容器內，跟隨聊天布局；這些節點都不存在時才會落到 `body` 末尾。

`rpg-hud` 僅在 Horae RPG 模式開啟且訊息上有 HUD DOM 時才有掛載點。

---

## 端口定義

```javascript
window.Horae.registerPort({
    id: 'example.bottom-status',
    slot: 'bottom-bar',
    title: '狀態',
    icon: 'fa-solid fa-chart-simple',
    priority: 50,

    render(context) {
        const { state, helpers } = context;
        const location = state.scene?.location || '未知地點';
        const time = state.timestamp?.story_time || '--:--';

        return `
            <span>${helpers.escapeHtml(time)}</span>
            <span>${helpers.escapeHtml(location)}</span>
        `;
    },

    update(context, root) {
        const span = root.querySelector('.location');
        if (span) span.textContent = context.state.scene?.location || '未知地點';
    },

    dispose(root) {
        // 清理事件、計時器、觀察器等
    },
});
```

### 欄位

| 欄位       | 類型       | 必填 | 說明                                                |
| ---------- | ---------- | :--: | --------------------------------------------------- |
| `id`       | `string`   |  是  | 端口唯一標識，詳見下方命名約定。重名會**靜默覆蓋**舊端口。 |
| `slot`     | `string`   |  是  | 插槽 ID，必須是上文表格中的一個。                   |
| `title`    | `string`   |  否  | 顯示名，用於 `drawer-tab` 標籤頁。                  |
| `icon`     | `string`   |  否  | Font Awesome 類名，用於 `drawer-tab` 標籤頁。       |
| `priority` | `number`   |  否  | 排序值，數字越小越排在前面。預設 `100`。                |
| `render`   | `function` |  是  | 首次掛載時呼叫，回傳內容。                          |
| `update`   | `function` |  否  | 每次重新整理呼叫。未提供時改放到 `render`。             |
| `dispose`  | `function` |  否  | 端口卸載或被替換時呼叫，用於清理。                  |

#### `id` 命名約定

端口 ID 全域共享，重名會被後註冊者覆蓋且不報錯。強烈建議採用三段式命名：

```
<作者命名空間>.<擴充功能名>.<功能>
```

僅使用 `status-card`、`hud` 這類通用名極易與其他擴充功能衝突。

### 回傳值

`render` 與 `update` 均接受以下回傳值：

- HTML 字串：以 `innerHTML` 寫入根節點
- `Node`（DOM 節點）
- jQuery 物件
- `null`：清空掛載點但保留位置
- `false`：移除整個掛載點（適合按條件隱藏）
- `undefined`：僅在 `update` 中表示已自行操作 `root`，無需重寫

`render` 拋出異常會顯示佔位提示。同一端口連續拋出 5 次後會被自動卸載，避免污染介面與主控台。

#### 安全提示

字串回傳值會透過 `innerHTML` 注入。任何來自聊天訊息、LLM 輸出、Provider 回傳值、使用者輸入的文字，都必須先經過 `context.helpers.escapeHtml()`，否則會引入 XSS 風險。如果輸出不需要 HTML 結構，建議直接回傳 `Node` 或自行操作 `textContent`。

---

## 上下文物件

```javascript
{
    api,            // window.Horae 引用
    context,        // 經安全篩選的 SillyTavern context facade
    settings,       // 已遮罩 API 憑證的 Horae 設定快照
    state,          // Horae 聚合狀態（getLatestState）
    rpg,            // 對應樓層的 RPG 快照
    chat,           // 目前聊天訊息陣列
    messageIndex,   // 樓層索引；全域插槽為 null
    meta,           // 目前樓層的 horae_meta；全域插槽為 null
    slot,           // 目前插槽 ID
    portId,         // 目前端口 ID
    firstRender,    // true 表示這是首次掛載
    root,           // 端口的根 DOM
    container,      // 所在的容器 DOM
    panelEl,        // 僅 message-panel：訊息面板根
    messageEl,      // 僅 message-panel / rpg-hud：訊息根
    hudEl,          // 僅 rpg-hud：HUD 根
    providers,      // 所有已註冊資料源的目前快照
    getProvider,    // (id) => providers[id] ?? null
    helpers,
}
```

安全界線：`context` 不會提供 `extensionSettings`、各主 API 設定、`accountStorage`、
`powerUserSettings` 或 `getRequestHeaders`；`settings` 亦不含 Horae 的自動摘要、輔助 API、
向量 API 與 rerank 金鑰，API URL 的常見 query／userinfo 憑證也會遮罩。端口若需要外部
資料，請透過 Data Provider 明確橋接必要欄位。

### `helpers`

| 欄位                   | 說明                                       |
| ---------------------- | ------------------------------------------ |
| `escapeHtml(str)`      | HTML 轉義                                  |
| `showToast(msg, type)` | 呼叫 Horae Toast                           |
| `isLightMode()`        | 目前是否為淺色主題                         |
| `t(key, vars?)`        | Horae i18n 翻譯                            |
| `eventSource`          | SillyTavern 事件總線                       |
| `event_types`          | SillyTavern 事件類型枚舉                   |

> Provider 之間不能互相依賴：建立 `providers` 時是同步遍歷的，後註冊的 Provider 在前一個的回呼裡讀到的是空物件。

---

## 資料源（Data Provider）

Provider 是端口讀取外部資料的統一入口。Horae 本身不預裝任何 Provider；任何擴充功能、使用者腳本都可以註冊自己的資料源，讓端口拿到所需的資料。

### 註冊

```javascript
const stop = window.Horae.registerDataProvider('myPlugin', () => {
    return window.MyPlugin?.getState?.() ?? null;
});
```

同一重新整理批次內，相同 `messageIndex` 下的 Provider 結果會被快取重複使用：每次重新整理裡 Provider 函式對每個樓層（含全域插槽的"無樓層"鍵）至多被呼叫一次。Provider 拋出異常時回傳值為 `null`，並在主控台記錄。

Provider 應保持純函式語義、避免內部副作用：只在被呼叫時按需讀取外部狀態並回傳快照，不要假定 Horae 會以特定頻率觸發它。

### 讀取

```javascript
render(context) {
    const data = context.providers.myPlugin || {};
    return `<span>${context.helpers.escapeHtml(data.title || '')}</span>`;
}
```

### 卸載

```javascript
stop(); // registerDataProvider 回傳的函式
// 或
window.Horae.unregisterDataProvider('myPlugin');
```

### 資料歸屬約定

端口可以同時讀取 Horae 狀態、目前樓層 meta 和任意已註冊的 Provider 資料，但建議遵循單一來源原則：同一欄位只由一處維護，端口僅做組合與展示。例如某個數值已經由外部擴充功能維護，Horae 端口可以讀取並顯示，但不要再讓 Horae 自己同時維護一份。

---

## 觸發重新整理的事件

`refreshPorts` 會在以下時機自動呼叫：

- Horae 初始化完成。
- `CHAT_CHANGED`：聊天切換。
- `MESSAGE_RENDERED` / `CHARACTER_MESSAGE_RENDERED`：訊息渲染。
- `MESSAGE_SWIPED`：分頁 swipe。
- `MESSAGE_EDITED` / `MESSAGE_DELETED`：訊息編輯或刪除後。
- Horae 主重新整理（`refreshAllDisplays`）。
- 註冊或卸載端口、註冊或卸載資料源。
- 切換抽屜到 `drawer-tab` 端口時，會單獨再渲染一次該端口。

短視窗內多次觸發會被合並為一次（30ms 防抖）。合並視窗內若收到不同範圍的重新整理請求，最終會以 `document` 為範圍執行，確保不會因為某次窄範圍重新整理覆蓋掉隨後的全域重新整理。

需要手動重繪時呼叫：

```javascript
window.Horae.refreshPorts();
```

---

## `render` 與 `update` 的區別

- 首次掛載或重新建立 root 時呼叫 `render`。`context.firstRender === true`。
- 之後每次重新整理呼叫 `update(context, root)`，`context.firstRender === false`。
- 沒有定義 `update` 時改放到 `render`，會整段重寫 `root.innerHTML`，會遺失輸入框焦點、滾動位置和事件綁定。
- 端口含互動元件時建議實作 `update`，僅修改需要變化的子節點。

### `drawer-tab` 性能建議

`drawer-tab` 端口在每次重新整理時都會被呼叫，無論標籤頁目前是否可見。如果端口的渲染開銷較大（例如完整資料瀏覽器、大型表格），應在 `update` 內自行判斷可見性後跳過：

```javascript
update(context, root) {
    const tabContent = root.closest('.horae-tab-content');
    if (tabContent && !tabContent.classList.contains('active')) return;
    // ... 真正的 DOM 更新
}
```

這樣不可見的標籤頁只會在使用者切到它時進行一次實際重繪。

---

## 主題與樣式約定

### 可用 CSS 變數

端口的根容器會繼承 Horae 主題變數：

| 變數                       | 用途             |
| -------------------------- | ---------------- |
| `--horae-primary`          | 主色             |
| `--horae-primary-light`    | 主色亮調         |
| `--horae-primary-dark`     | 主色暗調         |
| `--horae-accent`           | 強調色           |
| `--horae-bg`               | 背景             |
| `--horae-bg-secondary`     | 次背景           |
| `--horae-bg-hover`         | 懸停背景         |
| `--horae-border`           | 邊框             |
| `--horae-text`             | 主文字           |
| `--horae-text-muted`       | 次文字           |
| `--horae-success`          | 成功色           |
| `--horae-warning`          | 警示色           |
| `--horae-danger`           | 危險色           |
| `--horae-shadow`           | 陰影             |
| `--horae-radius`           | 圓角             |

### 淺色模式

端口所在容器在淺色主題下會帶上 `.horae-light` 類，按需配套樣式。

### 命名建議

端口注入的 CSS / DOM ID 建議加自己的命名空間前綴，例如 `myplugin-`、`myteam.tag-`，避免與其他端口衝突。

---

## 執行階段依賴

端口在 SillyTavern 環境下執行，可直接使用以下全域：

- `jQuery` / `$`
- `lodash` / `_`
- `toastr`

Horae 自身不依賴任何第三方變數系統。是否引入更多依賴由端口作者自行決定。

---

## 示例

### 狀態頁卡片（僅使用 Horae 狀態）

```javascript
window.Horae.registerPort({
    id: 'example.scene-card',
    slot: 'status',
    priority: 80,

    render(context) {
        const { state, helpers } = context;
        const location = state.scene?.location || '未知地點';
        const atmosphere = state.scene?.atmosphere || '';

        return `
            <div class="horae-state-section">
                <div class="horae-section-header">
                    <i class="fa-solid fa-location-dot"></i> 目前場景
                </div>
                <div>${helpers.escapeHtml(location)}</div>
                <div>${helpers.escapeHtml(atmosphere)}</div>
            </div>
        `;
    },
});
```

### 抽屜分頁（瀏覽目前樓層 meta）

```javascript
window.Horae.registerPort({
    id: 'example.meta-viewer',
    slot: 'drawer-tab',
    title: '元資料',
    icon: 'fa-solid fa-database',
    priority: 60,

    render(context) {
        const chat = context.chat || [];
        const last = chat[chat.length - 1];
        const meta = last?.horae_meta;
        if (!meta) return `<div class="horae-empty-hint">目前樓層暫時沒有元資料</div>`;
        const json = JSON.stringify(meta, null, 2);
        return `<pre style="white-space:pre-wrap;font-size:12px;">${context.helpers.escapeHtml(json)}</pre>`;
    },
});
```

### 帶計時器的端口

```javascript
window.Horae.registerPort({
    id: 'example.clock',
    slot: 'bottom-bar',

    render(context) {
        const span = document.createElement('span');
        const tick = () => { span.textContent = new Date().toLocaleTimeString(); };
        tick();
        context.root._horaeTimer = setInterval(tick, 1000);
        return span;
    },

    dispose(root) {
        if (root._horaeTimer) clearInterval(root._horaeTimer);
    },
});
```

### 按條件隱藏

```javascript
window.Horae.registerPort({
    id: 'example.boss-warning',
    slot: 'message-panel',

    render(context) {
        const danger = context.state.scene?.atmosphere === '緊張';
        if (!danger) return false;
        return `<div class="horae-port-error">⚠ 高緊張度場景</div>`;
    },
});
```

---

## 可選：與外部變數系統集成

Horae 不內建對任何變數系統的依賴。如果你同時使用了 MVU（或其他類似工具），可以用一段橋接程式碼把它接入 Horae 端口；這只是 Provider 的一種使用範例，並不是 Horae 必須配合的物件。

```javascript
// 示例：把 MVU 的 stat_data 接入 Horae 端口
window.Horae.registerDataProvider('mvu', () => {
    if (typeof globalThis.getAllVariables !== 'function') return null;
    const variables = globalThis.getAllVariables();
    return variables?.stat_data ?? null;
});

window.Horae.registerPort({
    id: 'example.mvu-bridge',
    slot: 'status',
    render(context) {
        const data = context.providers.mvu;
        if (!data) return `<div class="horae-empty-hint">未偵測到 MVU 資料</div>`;
        const json = JSON.stringify(data, null, 2);
        return `<pre style="white-space:pre-wrap;font-size:12px;">${context.helpers.escapeHtml(json)}</pre>`;
    },
});
```

同樣的寫法也適用於其他擴充功能：把對方的目前狀態包裝成一個 Provider，端口裡透過 `context.providers.<id>` 取用即可。

---

## 錯誤處理

- `render` / `update` 拋錯會替換為佔位提示。
- 同一端口連續拋錯達到 5 次會自動卸載，並 toast 提醒。
- Provider 拋錯時其結果為 `null`，端口需要自行兜底。

---

## 事件廣播

註冊或卸載端口時會送出：

- `window` 上的 `horae:portsChanged` 事件
- `eventSource.emit('horae:portsChanged', detail)`

`detail` 形如 `{ type: 'register' | 'unregister', id, slot }`。其他擴充功能可據此監聽端口變化。
