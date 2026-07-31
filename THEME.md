# Horae 外觀自訂指南

## 快速開始

Horae 的所有視覺樣式都由 **CSS 變數** 控制。只要覆寫這些變數，就能改變整個擴充功能的外觀。

### 方式一：修改 CSS 變數（建議）

在擴充功能設定 → 外觀設定 → 自訂 CSS 中輸入：

```css
#horae_drawer,
.horae-message-panel,
.horae-modal,
.horae-context-menu,
.horae-progress-overlay {
    --horae-primary: #ec4899;      /* 主色改為粉紅色 */
    --horae-primary-light: #f472b6;
    --horae-bg: #1a1020;           /* 背景改為深紫色 */
    --horae-bg-secondary: #2d1f3c;
}
```

### 方式二：匯入主題檔案

1. 取得別人分享的 `.json` 主題檔案
2. 擴充功能設定 → 外觀設定 → 點選匯入按鈕（📥）
3. 在主題下拉選單中選擇匯入的主題

### 方式三：匯出並分享

1. 調整好喜歡的樣式後，點選匯出按鈕（📤）
2. 瀏覽器會下載一個 `horae-theme.json` 檔案
3. 接著就能分享給其他使用者

---

## CSS 變數一覽

### 配色

| 變數 | 預設值（深色） | 說明 |
|------|---------------|------|
| `--horae-primary` | `#7c3aed` | 主色（按鈕、醒目顯示、漸層） |
| `--horae-primary-light` | `#a78bfa` | 較亮的主色（文字醒目顯示） |
| `--horae-primary-dark` | `#5b21b6` | 較深的主色（漸層起點） |
| `--horae-accent` | `#f59e0b` | 強調色（金色標記、NPC 名稱） |
| `--horae-success` | `#10b981` | 成功色（好感度為正值） |
| `--horae-warning` | `#f59e0b` | 警示色 |
| `--horae-danger` | `#ef4444` | 危險色（刪除、負好感度） |
| `--horae-info` | `#3b82f6` | 資訊色（NPC 外貌標籤） |

### 背景與邊框

| 變數 | 預設值（深色） | 說明 |
|------|---------------|------|
| `--horae-bg` | `#1e1e28` | 主要背景（區塊、卡片） |
| `--horae-bg-secondary` | `#2d2d3c` | 次要背景（容器、表頭） |
| `--horae-bg-hover` | `#3c3c50` | 游標停留時的背景 |
| `--horae-border` | `rgba(255,255,255,0.1)` | 邊框顏色 |

### 文字

| 變數 | 預設值（深色） | 說明 |
|------|---------------|------|
| `--horae-text` | `#e5e5e5` | 主要文字顏色 |
| `--horae-text-muted` | `#a0a0a0` | 次要文字顏色（標籤、提示） |

### 雷達圖

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `--horae-radar-color` | 跟隨 `--horae-primary` | 雷達圖資料區域的顏色（填色／邊線／頂點） |
| `--horae-radar-label` | 跟隨 `--horae-text` | 雷達圖標籤的文字顏色 |

### 其他

| 變數 | 預設值 | 說明 |
|------|--------|------|
| `--horae-shadow` | `0 4px 20px rgba(0,0,0,0.3)` | 陰影 |
| `--horae-radius` | `8px` | 大圓角 |
| `--horae-radius-sm` | `4px` | 小圓角 |

---

## 主要容器類別名稱

若要微調特定區域的樣式，請使用下列選擇器：

### 頂層容器

| 選擇器 | 說明 |
|--------|------|
| `#horae_drawer` | 主抽屜面板（設定、狀態、時間軸等） |
| `.horae-message-panel` | 訊息底部的中繼資料面板 |
| `.horae-modal` | 所有模態對話框 |
| `.horae-context-menu` | 右鍵選單 |
| `.horae-progress-overlay` | 進度遮罩層 |

### 抽屜內部

| 選擇器 | 說明 |
|--------|------|
| `.horae-tabs` | 分頁導覽列 |
| `.horae-tab` | 單一分頁按鈕 |
| `.horae-tab-contents` | 分頁內容容器 |
| `.horae-state-section` | 狀態區塊（儀表板內的各張卡片） |
| `.horae-settings-section` | 設定區塊 |

### 資料顯示

| 選擇器 | 說明 |
|--------|------|
| `.horae-timeline-item` | 時間軸事件卡片 |
| `.horae-timeline-list` | 時間軸清單容器 |
| `.horae-affection-item` | 好感度項目 |
| `.horae-npc-item` | NPC 卡片 |
| `.horae-full-item` | 物品項目 |
| `.horae-item-tag` | 物品標籤（圓角小膠囊） |
| `.horae-agenda-item` | 待辦事項 |
| `.horae-relationship-item` | 關係網路項目 |
| `.horae-relationship-list` | 關係網路清單容器 |
| `.horae-location-card` | 場景記憶卡片 |
| `.horae-mood-tag` | 情緒標籤（圓角膠囊） |
| `.horae-panel-rel-row` | 底部面板的關係列 |
| `.horae-empty-hint` | 沒有資料時的提示文字 |

### 摘要與壓縮

| 選擇器 | 說明 |
|--------|------|
| `.horae-timeline-item.summary` | 摘要事件卡片（active 狀態） |
| `.horae-timeline-item.horae-summary-collapsed` | 展開原始事件時顯示的收合指示列 |
| `.horae-summary-actions` | 摘要卡片上的切換／刪除按鈕容器 |
| `.horae-summary-toggle-btn` | 摘要／時間軸切換按鈕 |
| `.horae-summary-delete-btn` | 刪除摘要按鈕 |
| `.horae-compressed-restored` | 已被摘要取代但目前恢復顯示的事件（虛線框） |

### 自訂表格

| 選擇器 | 說明 |
|--------|------|
| `.horae-excel-table-container` | 表格外層容器 |
| `.horae-excel-table` | 表格主體 `<table>` |
| `.horae-excel-table th` | 表頭儲存格 |
| `.horae-excel-table td` | 資料儲存格 |
| `.horae-table-prompt-row` | 表格底部的提示詞區域 |

### 按鈕

| 選擇器 | 說明 |
|--------|------|
| `.horae-btn` | 一般按鈕 |
| `.horae-btn.primary` | 主色按鈕（紫色漸層） |
| `.horae-btn.danger` | 危險操作按鈕（紅色） |
| `.horae-icon-btn` | 小圖示按鈕（28×28） |
| `.horae-data-btn` | 資料管理大型按鈕（包含圖示＋文字） |
| `.horae-data-btn.primary` | 主要功能按鈕（橫跨兩欄） |

---

## 主題檔案格式

匯出的 `.json` 檔案結構如下：

```json
{
    "name": "我的主題",
    "author": "你的名稱",
    "version": "1.0",
    "variables": {
        "--horae-primary": "#ec4899",
        "--horae-primary-light": "#f472b6",
        "--horae-primary-dark": "#be185d",
        "--horae-accent": "#f59e0b",
        "--horae-bg": "#1a1020",
        "--horae-bg-secondary": "#2d1f3c",
        "--horae-bg-hover": "#3c2f50",
        "--horae-border": "rgba(255, 255, 255, 0.08)",
        "--horae-text": "#e5e5e5",
        "--horae-text-muted": "#a0a0a0"
    },
    "css": "/* 選用：額外 CSS 覆寫 */\n.horae-timeline-item { border-radius: 12px; }"
}
```

**欄位說明：**

- `name`：主題名稱（顯示在主題選擇器中）
- `author`：作者名稱（選用）
- `version`：版本號（選用）
- `variables`：CSS 變數的鍵值組，會覆寫預設變數
- `css`：額外的 CSS 程式碼（選用），用來調整無法透過變數設定的樣式

---

## 主題範例

### 櫻花粉

```json
{
    "name": "櫻花粉",
    "variables": {
        "--horae-primary": "#ec4899",
        "--horae-primary-light": "#f472b6",
        "--horae-primary-dark": "#be185d",
        "--horae-accent": "#fb923c",
        "--horae-bg": "#1f1018",
        "--horae-bg-secondary": "#2d1825",
        "--horae-bg-hover": "#3d2535",
        "--horae-text": "#fce7f3",
        "--horae-text-muted": "#d4a0b9"
    }
}
```

### 森林綠

```json
{
    "name": "森林綠",
    "variables": {
        "--horae-primary": "#059669",
        "--horae-primary-light": "#34d399",
        "--horae-primary-dark": "#047857",
        "--horae-accent": "#fbbf24",
        "--horae-bg": "#0f1a14",
        "--horae-bg-secondary": "#1a2e22",
        "--horae-bg-hover": "#2a3e32",
        "--horae-text": "#d1fae5",
        "--horae-text-muted": "#6ee7b7"
    }
}
```

### 海洋藍

```json
{
    "name": "海洋藍",
    "variables": {
        "--horae-primary": "#3b82f6",
        "--horae-primary-light": "#60a5fa",
        "--horae-primary-dark": "#1d4ed8",
        "--horae-accent": "#f59e0b",
        "--horae-bg": "#0c1929",
        "--horae-bg-secondary": "#162a45",
        "--horae-bg-hover": "#1e3a5f",
        "--horae-text": "#dbeafe",
        "--horae-text-muted": "#93c5fd"
    }
}
```

---

## 常見問題與外觀調整技巧

### 底部面板被其他元素遮住（無法互動）

部分酒館主題或預設的 z-index 較高，會遮住 Horae 底部面板。請在自訂 CSS 中加入：

```css
.horae-message-panel {
    margin-bottom: 10px;
    z-index: 9999;
    position: relative;
}
```

### 自訂頂端抽屜圖示

將頂端導覽列的 Horae 圖示換成自訂圖片：

```css
#horae_drawer .drawer-icon::before {
    background-image: url('你的图片URL') !important;
}
```

---

## 注意事項

1. **變數作用範圍**：CSS 變數定義在 `#horae_drawer`、`.horae-modal` 等頂層容器上。請勿定義在 `body` 或 `:root` 上，否則不會生效。

2. **`!important` 保護**：部分按鈕樣式使用 `!important`，以免受到酒館全域主題干擾。如需覆寫這些樣式，你的自訂 CSS 也要使用 `!important`。

3. **明暗模式**：選擇自訂主題後，會覆寫預設的深色／淺色變數。如果你的主題採淺色系，記得將 `--horae-text` 調整成深色。

4. **不影響酒館**：Horae 的所有樣式都限制在擴充功能的容器內，不會影響酒館主畫面。
