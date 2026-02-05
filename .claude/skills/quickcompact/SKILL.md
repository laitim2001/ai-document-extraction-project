---
name: quickcompact
description: 快速 compact 並保留執行狀態
trigger: /quickcompact
---

# Quick Compact for Development Continuation

執行以下 compact 並保留開發狀態：

請生成一個精簡的執行狀態摘要（限400字），包含：

1. **執行中任務**：正在做什麼、完成度、下一個具體動作
2. **檔案狀態表**：
   | 檔案 | 狀態 | 備註 |
   |------|------|------|
   | path | ✅完成/🔄進行中/⏳待處理 | 細節 |
3. **技術約束**：必須遵守的決策
4. **繼續指令**：compact 後立即執行的具體命令

然後執行 /compact 並使用上述內容作為摘要指引。