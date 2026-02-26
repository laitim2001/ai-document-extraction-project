---
name: quickcompact
description: 快速 compact 並保留執行狀態，輸出為 system prompt 格式以便無縫續接
trigger: /quickcompact
---

# Quick Compact for Development Continuation

生成精簡的執行狀態摘要（限400字），包含以下四個區塊：

1. **Key decisions + code patterns established**
   記錄本次會話確立的設計決策、架構模式、技術選型，確保下次續接不重複討論。

2. **檔案狀態**
   | 檔案 | 狀態 | 備註 |
   |------|------|------|
   | path | ✅已完成 / 🔄進行中（標註位置）/ ⏳待處理 | 關鍵細節 |

3. **Next steps**
   compact 後立即執行的具體動作（含命令或檔案路徑），按優先順序排列。

4. **Blockers**（如有）
   阻塞項、待用戶決策事項、已知風險。無則省略此區塊。

**輸出要求**：Format as system prompt for next chat, enabling immediate continuation.

然後執行 /compact 並使用上述內容作為摘要。