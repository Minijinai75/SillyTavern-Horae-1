# Horae 狀態欄接入說明（角色卡作者向）

本說明提供給**角色卡 / 預設 / 正則注入的 HTML 狀態欄作者**，目標是把 Horae 收集的劇情狀態顯示在你自己的狀態欄裡，與 Horae 自身介面並存。

如果你寫的是 SillyTavern 擴充功能、需要在 Horae 抽屜或聊天 UI 裡掛載元件，請改看 `Horae端口系統說明.md`。

---

## 工作模型

正則注入的狀態欄會以 iframe 形式渲染在訊息內或介面上。Horae 的執行階段 API 掛在 SillyTavern 主視窗的 `window.Horae` 上，因此 iframe 內需要透過 `window.parent.Horae` 存取。

```
[ SillyTavern 主視窗 ]
   ├── window.Horae           ← Horae 暴露的 API
   ├── window.SillyTavern     ← ST 官方 API（含事件總線）
   └── <iframe>               ← 你的狀態欄
        └── window.parent.Horae / SillyTavern
```

Horae 與 MVU 無任何耦合，可以獨立使用，也可以與 MVU 共存：狀態欄中兩個資料源可以同時讀取，各自渲染各自負責的部分。

---

## 可用入口

### `window.parent.Horae` 主要方法

| 方法 | 回傳 | 說明 |
| ---- | ---- | ---- |
| `getLatestState(skipLast?)` | `Object` | 截至目前樓層的聚合狀態（時間、地點、角色、物品、關係等）。`skipLast` 可跳過末尾若干樓層。 |
| `getRpgState(skipLast?)`    | `Object` | RPG 模板下的屬性、技能、裝備、聲望、貨幣、據點等資料。 |
| `getEvents(limit?, level?)` | `Array`  | 最近事件列表，可按重要等級過濾。 |
| `getChat()`                 | `Array`  | 目前聊天訊息陣列（與 ST `getContext().chat` 同源）。 |
| `getSettings()`             | `Object` | Horae 的目前設定深層快照；金鑰及 URL 中常見的憑證參數會遮罩，可用於讀取主題狀態等。 |
| `isEnabled()`               | `Boolean`| Horae 是否啟用。 |
| `version`                   | `String` | Horae 擴充功能版本。 |
| `portApiVersion`            | `Number` | 端口協議版本。 |

所有方法均為同步回傳，**不會修改 Horae 內部狀態**，可放心在渲染循環裡反覆呼叫。

### `window.parent.SillyTavern.getContext()`

由 SillyTavern 提供，可拿到 `eventSource` / `event_types`，用於事件訂閱。

---

## `getLatestState()` 回傳結構

```typescript
{
    timestamp: {
        story_date: string,   // 例如 "1024年 春之月12日"
        story_time: string,   // 例如 "14:30"
        absolute:   string,   // 絕對時間字串（可選）
    },
    scene: {
        location:           string,
        characters_present: string[],
        atmosphere:         string,
    },
    costumes:    { [角色名]: string },
    items:       {
        [物品名]: {
            holder?:      string,
            location?:    string,
            description?: string,
            importance?:  '' | '!' | '!!',
            icon?:        string,
        }
    },
    deletedItems:   string[],
    deletedAgenda:  string[],
    events:         Array<any>,
    affection:      { [角色名]: number | object },
    npcs:           { [角色名]: object },
    agenda:         Array<any>,
    mood:           { [角色名]: string },
    relationships:  Array<any>,
}
```

欄位在劇情未觸及時為空物件 / 空陣列，渲染前請做空值兜底。

## `getRpgState()` 回傳結構

```typescript
{
    bars:        { [owner]: { [name]: { value, max, ... } } },
    status:      { [owner]: Array<{ name, ... }> },
    skills:      { [owner]: Array<{ name, level, desc }> },
    attributes:  { [owner]: { [attr]: number } },
    reputation:  { [owner]: { [category]: { value, subItems } } },
    equipment:   { [owner]: { [slot]: object } },
    levels:      { [owner]: number },
    xp:          { [owner]: number },
    currency:    { [owner]: { [currency]: number } },
    strongholds: Array<object>,
}
```

僅當 Horae 的 RPG 模板啟用時才會有資料，否則各欄位為空物件/空陣列。

## `getEvents()` 元素結構

```typescript
{
    messageIndex: number,
    eventIndex:   number,
    timestamp: {
        story_date: string,
        story_time: string,
    },
    event: {
        summary: string,
        level:   'minor' | 'normal' | 'major' | string,
        // ... 其他自訂欄位
    }
}
```

---

## 觸發重新渲染

iframe 沒法直接訂閱 Horae 內部重新整理，但可以用以下三種方式之一感知資料變化：

### 方式一：訂閱 SillyTavern 事件（推薦）

```javascript
const ctx = window.parent.SillyTavern?.getContext?.();
if (ctx?.eventSource && ctx.event_types) {
    ['MESSAGE_RENDERED', 'CHARACTER_MESSAGE_RENDERED',
     'MESSAGE_SWIPED', 'MESSAGE_EDITED', 'MESSAGE_DELETED',
     'CHAT_CHANGED'].forEach(name => {
        const key = ctx.event_types[name];
        if (key) ctx.eventSource.on(key, render);
    });
}
```

涵蓋 90% 的狀態變化時機，是首選方案。

### 方式二：監聽 Horae 自身送出的 CustomEvent

Horae 在端口變化時會向主視窗送出：

```javascript
window.parent.addEventListener('horae:portsChanged', render);
```

注意這是端口註冊/卸載時觸發，不會覆蓋普通的劇情狀態變化。僅在你需要回應 Horae 自身的 UI 設定變化時使用。

### 方式三：輪詢 + 狀態比對（兜底）

某些早期版本或特殊環境下事件訂閱可能不可用，此時退化為定時擷取並比較關鍵欄位：

```javascript
let _last = '';
setInterval(() => {
    const s = window.parent.Horae?.getLatestState?.();
    if (!s) return;
    const sig = (s.timestamp?.story_time || '') + '|' + (s.scene?.location || '');
    if (sig !== _last) { _last = sig; render(); }
}, 1500);
```

---

## 安全與穩定性

1. **永遠做存在性檢查**。`window.parent.Horae` 可能因為加載順序、使用者未啟用 Horae、或預覽視窗等原因為 `undefined`。
2. **所有取自 Horae 的字串都要 HTML 轉義**。地點、角色名、物品描述等均來自 LLM 輸出，直接拼到 `innerHTML` 會引入 XSS。
3. **不要修改回傳物件**。`getLatestState()` 等回傳的是 Horae 內部物件的引用，寫入會污染下次重新整理的結果。
4. **頻率控制**。`render` 內部如果 DOM 操作較重，建議自己加 `requestAnimationFrame` 或簡單防抖，避免一次訊息事件觸發多次重排。

---

## 完整示例

可直接作為正則注入內容使用的最小骨架：

```html
<!doctype html>
<meta charset="utf-8">
<style>
.hb{font-family:'Segoe UI','Microsoft YaHei',sans-serif;max-width:520px;margin:10px auto;
    border:2px solid #8B5A2B;border-radius:10px;background:#fff8ee;padding:10px;
    box-shadow:0 2px 8px rgba(0,0,0,.2);font-size:13px;color:#5c3a21}
.hb-h{display:flex;justify-content:space-between;font-weight:bold;color:#8B5A2B;
      border-bottom:1px solid rgba(139,90,43,.3);padding-bottom:6px;margin-bottom:8px}
.hb-row{display:flex;justify-content:space-between;padding:3px 0}
.hb-row+.hb-row{border-top:1px dashed rgba(139,90,43,.15)}
.hb-tag{display:inline-block;font-size:11px;background:#fed7aa;color:#c2410c;
        border-radius:6px;padding:1px 6px;margin:1px 2px}
.hb-empty{color:#999;font-style:italic;text-align:center;padding:6px}
.hb-off{opacity:.45}
</style>

<div class="hb" id="hb">
  <div class="hb-h">
    <span>📍 <span id="hb-loc">--</span></span>
    <span id="hb-time">--:--</span>
  </div>
  <div id="hb-people" class="hb-empty">無在場角色</div>
  <div id="hb-items"  class="hb-empty">無物品</div>
</div>

<script>
(function(){
  function esc(s){
    return String(s == null ? '' : s)
      .replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function readHorae(){
    try {
      var H = window.parent && window.parent.Horae;
      return H ? H.getLatestState() : null;
    } catch (e) { return null; }
  }

  function render(){
    var s = readHorae();
    var box = document.getElementById('hb');
    if (!s){ box.classList.add('hb-off'); return; }
    box.classList.remove('hb-off');

    document.getElementById('hb-loc').textContent  = s.scene && s.scene.location || '未知地點';
    document.getElementById('hb-time').textContent = s.timestamp && s.timestamp.story_time || '--:--';

    var ppl = (s.scene && s.scene.characters_present) || [];
    var pe = document.getElementById('hb-people');
    if (ppl.length){
      pe.className = '';
      pe.innerHTML = ppl.map(function(n){ return '<span class="hb-tag">'+esc(n)+'</span>'; }).join('');
    } else {
      pe.className = 'hb-empty'; pe.textContent = '無在場角色';
    }

    var items = s.items || {};
    var keys = Object.keys(items);
    var ie = document.getElementById('hb-items');
    if (keys.length){
      ie.className = '';
      ie.innerHTML = keys.slice(0, 6).map(function(k){
        var it = items[k] || {};
        var tail = it.holder || it.location || '';
        return '<div class="hb-row"><span>'+esc(k)+'</span><span style="color:#888">'+esc(tail)+'</span></div>';
      }).join('');
    } else {
      ie.className = 'hb-empty'; ie.textContent = '無物品';
    }
  }

  function bindEvents(){
    try{
      var ctx = window.parent && window.parent.SillyTavern && window.parent.SillyTavern.getContext();
      if (!ctx || !ctx.eventSource || !ctx.event_types) return false;
      ['MESSAGE_RENDERED','CHARACTER_MESSAGE_RENDERED','MESSAGE_SWIPED',
       'MESSAGE_EDITED','MESSAGE_DELETED','CHAT_CHANGED'].forEach(function(name){
        var key = ctx.event_types[name];
        if (key) ctx.eventSource.on(key, render);
      });
      return true;
    } catch(e){ return false; }
  }

  function start(){
    render();
    if (!bindEvents()){
      var n = 0, t = setInterval(function(){
        render();
        if (++n > 240) clearInterval(t);
      }, 1500);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
</script>
```

---

## 與 MVU 共存的寫法

Horae 與 MVU 資料互不衝突，可以在同一份狀態欄裡同時讀：

```javascript
function readBoth(){
    var horae = null, stat = null;
    try { horae = window.parent.Horae && window.parent.Horae.getLatestState(); } catch(e){}
    try {
        var g = (window.parent.getAllVariables || window.getAllVariables);
        stat = typeof g === 'function' ? (g().stat_data || null) : null;
    } catch(e){}
    return { horae: horae, mvu: stat };
}
```

建議遵循單一來源原則：同一欄位只交給一個系統維護，狀態欄只做組合顯示。例如位置、角色在場、劇情物品、聲望、金錢、好感交給 Horae，自訂數值交給 MVU，兩邊各自獨立、互不寫入。

---

## 調試

```javascript
console.log('[Horae]', window.parent.Horae?.version, window.parent.Horae?.getLatestState?.());
```

主控台直接呼叫 `window.Horae.getLatestState()` 即可立即拿到目前最新資料，便於在卡片裡打斷點核對欄位。
