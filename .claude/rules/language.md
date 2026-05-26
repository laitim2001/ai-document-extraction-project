# 語言規則完整規範

> **本文件為 CLAUDE.md §語言設定 的詳細展開**。摘要規則在 CLAUDE.md，常違反詞彙對照表 / 高風險回覆類型 / 自我檢查步驟在此處。

---

## 核心規則（重申）

AI 助手在所有對話中**必須全程使用繁體中文**回應用戶。違反 = task 未完 = broken project signal。

---

## 唯一可保留原文的 6 類

| # | 類別 | 範例 |
|---|------|------|
| 1 | 程式碼識別符 | `calculateConfidenceScore`、`useDocumentUpload`、`PROCESSING_QUEUE_STATUS` |
| 2 | 檔案路徑 | `src/services/extraction-v3/`、`messages/zh-TW/common.json` |
| 3 | API 端點 | `/api/documents/upload`、`/v1/companies/[id]` |
| 4 | Commit hash + branch 名 | `7905f9e`、`feature/change-068` |
| 5 | CHANGE/FIX 編號、文檔 section 編號 | `CHANGE-068`、`FIX-052`、`§3.2`、`H1-H6` |
| 6 | Vendor / 產品名 | `Azure OpenAI`、`Prisma`、`Next.js`、`shadcn/ui`、`Playwright` |

**6 類之外**的任何 non-code 英文 phrase 都屬於 violation。

---

## 常違反詞彙對照表（必須翻譯）

### 狀態 / 流程詞

| 英文（違反） | 繁體中文（正確） |
|------------|----------------|
| Status | 狀態 |
| Next | 下一步 |
| Done | 已完成 |
| pending | 待處理 / 待辦 |
| ticked | 已勾選 |
| In progress | 進行中 |
| Blocked | 已阻塞 |
| Resolved | 已解決 |
| Failed | 失敗 |
| Skipped | 已跳過 |
| Cancelled | 已取消 |

### 判斷 / 評估詞

| 英文（違反） | 繁體中文（正確） |
|------------|----------------|
| verdict | 判決 / 結論 |
| hypothesis | 假設 |
| validated | 已驗證 |
| refuted | 已反證 |
| confirmed | 已確認 |
| approved | 已批准 |
| rejected | 已拒絕 |
| deferred | 已延後 |

### 動作 / 處理詞

| 英文（違反） | 繁體中文（正確） |
|------------|----------------|
| review | 審查 / 檢視 |
| merge | 合併 |
| rollback | 回滾 |
| recovery | 恢復 |
| migration | 遷移（程式碼識別符例外） |
| deployment | 部署 |
| rollout | 推出 / 部署 |

### 比較 / 結構詞

| 英文（違反） | 繁體中文（正確） |
|------------|----------------|
| priority queue locked | 優先順序鎖定 |
| lessons learned | 教訓 / 經驗總結 |
| tradeoff | 取捨 |
| breakdown | 細分 |
| overview | 總覽 |
| summary | 摘要 / 總結 |
| baseline | 基準 |
| benchmark | 基準測試 |

### 數量 / 計量詞

| 英文（違反） | 繁體中文（正確） |
|------------|----------------|
| total | 總計 |
| approximately | 約 / 大約 |
| at most | 最多 |
| at least | 至少 |

---

## Phase Gate Verdict 例外規則

`PASS` / `FAIL` / `PARTIAL` 作為 verdict word 可保留作為 vendor convention，**但** narrative 描述要中文：

✅ 正確：「G1 通過」「G2 未達標」「Phase Gate 部分通過（verdict: PARTIAL）」
❌ 違反：「G1 PASS within tolerance」（全英文 sentence）

---

## Hard Enforcement Gate

### 每段 reply 之前

Think：「呢段 reply 入面所有 non-code 英文 word 是否每個都在 6 類保留範圍？」

非保留範圍 → 立即翻譯。

### 每段 reply 完成後

**強制 final self-check** — scan 全文，任何 non-code English phrase = violation。

不能依賴 memory 自動 reset — **每段 reply** mandatory active self-check，session-internal drift 必須立即 catch。

---

## 高風險回覆類型（必須逐字自檢）

以下類型的回覆**累積觀察到最易違反**：

| # | 類型 | 為何高風險 |
|---|------|----------|
| 1 | Phase / Sprint closeout summary | 含大量 status word、verdict word |
| 2 | CHANGE/FIX 完成報告 | 含大量 status word、流程詞 |
| 3 | Hypothesis 再評估 | 含 validated/refuted/confirmed 等 |
| 4 | Multi-section markdown reply（含 table + bullet + heading） | 結構性詞彙易夾雜英文 |
| 5 | 並行 Agent 狀態回報 | 含 status、progress、verdict |
| 6 | 程式碼 review 結果 | 含 issue、warning、suggestion 等 |
| 7 | 比較 / 對照分析 | 含 vs、tradeoff、pros/cons |

寫這類回覆時 → **逐字** 自檢，不要倚賴語感。

---

## 範例對比

### ❌ 違反（夾雜英文 status word）

```
## CHANGE-068 Status

| Task | Status |
|------|--------|
| API endpoint | Done |
| Service layer | In progress |
| Component | Pending |

Next step: 繼續實作 Component。
```

### ✅ 正確（全部翻譯）

```
## CHANGE-068 狀態

| 任務 | 狀態 |
|------|------|
| API 端點 | 已完成 |
| 服務層 | 進行中 |
| 組件 | 待處理 |

下一步：繼續實作組件。
```

---

## 違反處理

如果用戶指出回覆中有英文夾雜：
1. **立即承認**並回顧違反的詞
2. **不要找藉口**（如「我以為這個詞可以保留」）
3. **重寫**該段落或回覆
4. **更新本文件**（如果是新發現的高頻違反詞）

---

## 相關 Memory 檔案

- `feedback_chinese_primary_replies.md`（如存在）— 記錄累積違反 surface

---

*本文件建立日期：2026-05-26（CLAUDE.md v4.0.0）*
*基於 EKP CLAUDE.md §11 中文紀律 binding strict rule 結構*
