#!/usr/bin/env bash
#
# verify-claude-md-sync.sh
#
# 驗證主 CLAUDE.md 中聲稱的代碼規模統計是否與 codebase 實際情況一致。
# 方案 A (輕量)：只檢查核心 6 項統計數字，差異超過閾值時警告（不阻擋）。
#
# 使用方式:
#   bash scripts/verify-claude-md-sync.sh
#   exit code: 0 = 同步 / 1 = 有漂移（警告但不失敗）/ 2 = 腳本錯誤
#
# 觸發時機: 由 .claude/settings.json 的 Stop hook 自動執行。
#
# 閾值: 差異 > 5% 或絕對值 > 10 時警告
#

set -u

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLAUDE_MD="$PROJECT_ROOT/CLAUDE.md"

if [[ ! -f "$CLAUDE_MD" ]]; then
  echo "[verify-claude-md-sync] ERROR: CLAUDE.md not found at $CLAUDE_MD" >&2
  exit 2
fi

# 實測統計
actual_services=$(find "$PROJECT_ROOT/src/services" -maxdepth 3 -type f -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')
actual_routes=$(find "$PROJECT_ROOT/src/app/api" -type f -name "route.ts" 2>/dev/null | wc -l | tr -d ' ')
actual_components=$(find "$PROJECT_ROOT/src/components" -type f -name "*.tsx" 2>/dev/null | wc -l | tr -d ' ')
actual_hooks=$(find "$PROJECT_ROOT/src/hooks" -type f -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')
actual_i18n=$(ls "$PROJECT_ROOT/messages/en/" 2>/dev/null | wc -l | tr -d ' ')
actual_models=$(grep -cE "^model [A-Z]" "$PROJECT_ROOT/prisma/schema.prisma" 2>/dev/null || echo 0)
actual_enums=$(grep -cE "^enum [A-Z]" "$PROJECT_ROOT/prisma/schema.prisma" 2>/dev/null || echo 0)

# CLAUDE.md 聲稱值（用 grep 提取 **數字** 格式中的數字）
extract_claimed() {
  local label="$1"
  # 提取形如 "| <label> | **NNN** |" 中的 NNN
  grep -E "\| $label\b" "$CLAUDE_MD" | grep -oE "\*\*[0-9]+\*\*" | head -1 | grep -oE "[0-9]+"
}

claimed_services=$(extract_claimed "業務服務")
claimed_routes=$(extract_claimed "API 路由文件")
claimed_components=$(extract_claimed "React 組件")
claimed_hooks=$(extract_claimed "自定義 Hooks")
claimed_i18n=$(extract_claimed "i18n JSON 文件")
claimed_models=$(extract_claimed "Prisma Models")
claimed_enums=$(extract_claimed "Prisma Enums")

# 若無法提取，設為 0（會觸發警告）
claimed_services=${claimed_services:-0}
claimed_routes=${claimed_routes:-0}
claimed_components=${claimed_components:-0}
claimed_hooks=${claimed_hooks:-0}
claimed_i18n=${claimed_i18n:-0}
claimed_models=${claimed_models:-0}
claimed_enums=${claimed_enums:-0}

drift_count=0
warnings=""

check_drift() {
  local name="$1"
  local actual="$2"
  local claimed="$3"
  local diff=$(( actual > claimed ? actual - claimed : claimed - actual ))
  local threshold_abs=10
  # 5% 閾值
  local threshold_pct=$(( claimed / 20 ))
  [[ $threshold_pct -lt $threshold_abs ]] && threshold_pct=$threshold_abs

  if [[ $diff -gt $threshold_pct ]]; then
    drift_count=$((drift_count + 1))
    warnings+="  ⚠️  $name: CLAUDE.md 聲稱 $claimed，實測 $actual（差異 $diff）\n"
  fi
}

check_drift "Services"   "$actual_services"   "$claimed_services"
check_drift "API Routes" "$actual_routes"     "$claimed_routes"
check_drift "Components" "$actual_components" "$claimed_components"
check_drift "Hooks"      "$actual_hooks"      "$claimed_hooks"
# i18n 文件數是 3 種語言 × 34 = 102，但實測只查 en/ 一個語言
check_drift "i18n (en/)" "$actual_i18n"       "$(( claimed_i18n / 3 ))"
check_drift "Prisma Models" "$actual_models"  "$claimed_models"
check_drift "Prisma Enums"  "$actual_enums"   "$claimed_enums"

if [[ $drift_count -gt 0 ]]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔔 [verify-claude-md-sync] 偵測到 $drift_count 項 CLAUDE.md 統計漂移"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo -e "$warnings"
  echo "📖 建議執行 /refresh-codebase-analysis 進行完整同步"
  echo "   或手動更新主 CLAUDE.md §代碼規模概覽區塊"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi

echo "[verify-claude-md-sync] ✅ CLAUDE.md 統計與 codebase 一致（$actual_services services / $actual_routes routes / $actual_components components / $actual_hooks hooks）"
exit 0
