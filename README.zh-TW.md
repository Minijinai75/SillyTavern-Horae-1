# Horae - 時光記憶 v1.15.1-minijin.1 | SillyTavern 記憶增強擴充功能（Minijin Fork）

[English](README.md) | [簡體中文](README.zh-CN.md) | **繁體中文**

![Image](https://github.com/SenriYuki/SillyTavern-Horae/blob/main/HoraeLogo.jpg)

> *Horae（荷賴）— 希臘神話中掌管時序的女神*

長篇 RP 玩家一定遇過這些老問題 —— AI 的記憶跟金魚差不多：昨天的事說成今天早上，連幾天前發生的事也總說是昨天；上一幕穿制服，下一幕突然換成便服；NPC 關係顛倒；送出去的禮物憑空消失，丟掉的東西又回到手裡。

**Horae 用結構化的時間錨點，替你的 AI 裝上一本可靠的記憶帳本。**

---

## Minijin Fork：回覆後輔助 API 結算

這個 fork 以 [`7a88598`](https://github.com/SenriYuki/SillyTavern-Horae/commit/7a8859897bbfc6f0781ac5eb2451bc607e2bab95) 上游提交為基礎，新增可選用的回覆後結算模式：

- 功能**預設關閉**；關閉時完整保留上游原有行為。
- 直接沿用現有「輔助 API」的位址、金鑰、模型與依序處理佇列，不必再設定另一組認證資訊。
- 開啟後，主模型提示詞仍保留 Horae 記憶資料與召回內容，但不再攜帶標籤／輸出規則。
- 正文先正常顯示，再由輔助 API 非同步擷取原版 Horae 標籤格式，並寫回對應訊息與對應 swipe。
- 輔助 API 失敗時**絕不改用主 API**；已產生的正文不受影響，並會顯示錯誤提示。
- 下一次主請求送出前，最多只會等待相符的待處理結算 **2 秒**；超過時間便繼續，不會一直卡住。
- 結算會鎖定聊天、樓層、swipe、正文與記憶版本；切換聊天、快速滑頁或手動修改資料時，舊結果不會覆寫新版本。
- 開關只接受本機使用者在輔助 API 設定完整時明確啟用，不會被共享設定檔、角色卡或外部設定偷偷打開。
- 訊息面板的手動「AI 分析」仍可作為重試入口。

Fork 目標版本：**SillyTavern 1.18.0**。實機驗證日期：**待最終驗證補登**。此處只是驗證佔位，不代表最終測試已經通過。

Fork 儲存庫：[Minijinai75/SillyTavern-Horae-1](https://github.com/Minijinai75/SillyTavern-Horae-1)。維護細節見 [FORK_NOTES.md](FORK_NOTES.md)。

---

## 亮點功能

**RPG 模式 —— 血條、技能、聲望、裝備、等級、貨幣一目了然**
為西幻／修真／戰鬥向角色卡量身打造的全模組化 RPG 系統。各子系統（屬性條、多維屬性、技能、聲望、裝備、等級、貨幣）都有**獨立開關**，可依需求搭配。關閉時不注入提示詞，也不消耗 Token。

**向量記憶引擎 —— 找回被摺疊的細節**
專為搭配「自動摘要與隱藏」設計的智慧外腦！當對話提到歷史事件時，擴充功能會自動從隱藏的舊時間線中精準召回相關片段。全程透過 Web Worker 在本機運算，不消耗 API 額度。

**新手導覽 —— 第一次用也不迷路**
首次使用 Horae 的使用者會自動觸發互動式導覽。

**自助美化工具 —— 不會寫 CSS 也能自訂**
視覺化美化面板。可用色相條、飽和度／亮度滑桿快速調色，一鍵切換日夜模式，也能匯入圖片 URL 裝飾介面。（⚠️ 製作 Horae 擴充功能的美化樣式不用向我取得授權，請自由使用。）

**輔助 API —— 背景任務不佔用主 API**
可另外設定一組 OpenAI 相容端點，供 AI 分析、下方欄位／樓層魔術棒、傳送前補全、自動摘要、AI 智慧補全與手動多選壓縮使用。輔助 API 請求會依序排隊，降低同時呼叫而觸發速率限制的風險；API 位址、金鑰與模型不會隨 Horae 設定檔匯出。

**場景記憶** · **情緒 & 關係網路** · **自動摘要** · **告別「永遠的昨天」** · **衣服不再亂穿** · **NPC 不會越寫越糊** · **物品欄終於可靠了** · **待辦事項防遺忘** · **自訂表格** · **變化驅動省 Token**

---

## 快速安裝

1. 開啟 SillyTavern → 上方擴充功能面板（積木圖示）→「安裝擴充功能」
2. 貼上 `https://github.com/Minijinai75/SillyTavern-Horae-1.git`，點選安裝
3. 安裝完成後重新整理頁面即可使用

> 配套正規表示式會在擴充功能第一次載入時**自動注入**，不需要手動匯入。

---

## v1.14.0 更新內容

### 輔助 API

- **獨立設定區塊**：新增「輔助 API」，不依賴自動摘要開關，可另外填寫 API 位址、金鑰與模型。
- **三組用途開關**：可分別用於 AI 分析／魔術棒／傳送前補全、自動摘要／AI 智慧補全，以及手動多選壓縮。
- **依序處理佇列**：輔助 API 請求會排隊執行，降低多個背景任務同時觸發 429 的機率。
- **預設不改用主 API**：輔助 API 失敗時，預設不會私下改用主 API，避免繼續觸發主 API 的速率限制。
- **安全匯出**：API 位址、金鑰與模型不會寫入 Horae 設定檔的匯出內容。

> 更早版本的更新日誌請查看 [CHANGELOG.md](CHANGELOG.md)

---

## 相容性

- **上游相容基準**：SillyTavern 1.13.0+（AI 分析功能需要 1.13.5+）
- **Fork 驗證目標**：SillyTavern 1.18.0；實機驗證日期：**待最終驗證補登**
- **平台**：桌面版與行動版

---

## 多語言支援


| 語言      | 狀態   |
| ------- | ---- |
| 簡體中文    | ✅ 完整 |
| 繁體中文    | ✅ 完整 |
| English | ✅ 完整 |
| 한국어     | ✅ 完整 |
| 日本語     | ✅ 完整 |
| Русский | ✅ 完整 |


希望 Horae 支援你的語言？歡迎提交 [Issue](https://github.com/SenriYuki/SillyTavern-Horae/issues) 或直接 PR 翻譯檔案！

---

## 公開 API（供其他擴充功能／預設腳本呼叫）

Horae 載入完成後，會透過 `window.Horae` 提供唯讀 API：

```js
// 判斷 Horae 是否已安裝且啟用
window.Horae?.isEnabled()        // → true / false

// 讀取目前世界狀態（時間、地點、在場角色、服裝、物品、情緒、NPC……）
window.Horae?.getLatestState()   // → state 物件

// 讀取時間線事件
window.Horae?.getEvents(10)      // → 最近 10 筆事件

// 讀取設定（淺層複製）
window.Horae?.getSettings()

// 版本號
window.Horae?.version            // → "1.15.1-minijin.1"
```

設定變更事件透過酒館的 `eventSource` 廣播：

```js
eventSource.on('horae:settingsChanged', (data) => {
    console.log('Horae enabled:', data.enabled);
});
```

> 所有方法都是**唯讀**，不提供任何寫入操作。

---

> 更新日誌請查看 [CHANGELOG.md](CHANGELOG.md) 或 [簡體中文版](README.zh-CN.md)

有 bug 或建議歡迎回饋！

> ⚠️ 本專案為業餘開發，回覆可能有延遲，敬請見諒。

**原作者：SenriYuki**
**Fork 維護者：Minijinai75**

### 翻譯致謝

- **俄語 (Русский)** — [@KiskaSora](https://github.com/KiskaSora)

### 致謝

- [@baibai-git](https://github.com/baibai-git) — PR #5 整合貢獻
