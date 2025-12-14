# 歷史發票批量預處理方案
## 從 2,230 份歷史文件建立完整 Data Mapping

---

## 為什麼需要處理全部歷史數據？

### 樣本 vs 全量對比

| 方案 | 覆蓋率 | 風險 | 成本 |
|------|--------|------|------|
| **只用 3-5 張樣本** | ~60-70% | 遺漏低頻術語，上線後頻繁遇到未知術語 | 低 |
| **處理全部歷史數據** | ~95%+ | 幾乎涵蓋所有術語 | 中等 |

### 實際例子

假設 TOLL 有以下費用類型：
```
常見 (每張發票都有):
├── OCEAN FREIGHT        ← 樣本會包含 ✓
├── THC                  ← 樣本會包含 ✓
├── DELIVERY             ← 樣本會包含 ✓

偶爾出現 (10-20% 發票):
├── DETENTION FEE        ← 樣本可能遺漏 ⚠️
├── X-RAY CHARGE         ← 樣本可能遺漏 ⚠️
├── VGM FEE              ← 樣本可能遺漏 ⚠️

罕見 (1-5% 發票):
├── CUSTOMS INSPECTION   ← 樣本幾乎肯定遺漏 ❌
├── REEFER SURCHARGE     ← 樣本幾乎肯定遺漏 ❌
└── SPECIAL HANDLING     ← 樣本幾乎肯定遺漏 ❌
```

**結論：處理全部歷史數據是正確的策略！**

---

## 批量預處理流程設計

```
┌─────────────────────────────────────────────────────────────────────────┐
│              HISTORICAL DATA PREPROCESSING PIPELINE                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ PHASE 1: 批量 OCR 提取 (自動化)                                 │    │
│  │ ══════════════════════════════                                  │    │
│  │                                                                  │    │
│  │  2,230 份 PDF                                                   │    │
│  │       │                                                          │    │
│  │       ▼                                                          │    │
│  │  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐        │    │
│  │  │   Azure     │────▶│   提取      │────▶│   存儲到    │        │    │
│  │  │ Doc Intel   │     │ Line Items  │     │   Database  │        │    │
│  │  │ (批量調用)  │     │ + Header    │     │             │        │    │
│  │  └─────────────┘     └─────────────┘     └─────────────┘        │    │
│  │                                                                  │    │
│  │  預計成本: 2,230 × 2頁 × $0.01 = ~$45 USD                       │    │
│  │  預計時間: 2-4 小時（並行處理）                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ PHASE 2: 術語彙總與去重 (自動化)                                │    │
│  │ ══════════════════════════════                                  │    │
│  │                                                                  │    │
│  │  輸入: 所有提取的 Line Items                                    │    │
│  │                                                                  │    │
│  │  處理:                                                          │    │
│  │  1. 標準化 (轉大寫, 去除多餘空格)                               │    │
│  │  2. 按 Forwarder 分組                                           │    │
│  │  3. 計算每個術語出現頻率                                        │    │
│  │  4. 識別唯一術語                                                │    │
│  │                                                                  │    │
│  │  輸出:                                                          │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │ Forwarder │ Term                    │ Count │ % of Inv  │    │    │
│  │  │───────────┼─────────────────────────┼───────┼───────────│    │    │
│  │  │ TOLL      │ OCEAN FREIGHT           │  368  │   100%    │    │    │
│  │  │ TOLL      │ THC                     │  365  │    99%    │    │    │
│  │  │ TOLL      │ DELIVERY                │  320  │    87%    │    │    │
│  │  │ TOLL      │ HANDLING FEE            │  245  │    67%    │    │    │
│  │  │ TOLL      │ DETENTION               │   52  │    14%    │    │    │
│  │  │ TOLL      │ X-RAY CHARGE            │   18  │     5%    │    │    │
│  │  │ ...       │ ...                     │  ...  │   ...     │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ PHASE 3: AI 自動分類建議 (半自動)                               │    │
│  │ ══════════════════════════════                                  │    │
│  │                                                                  │    │
│  │  對每個唯一術語:                                                │    │
│  │  1. 先用 Universal Mapping 嘗試匹配                             │    │
│  │  2. 無法匹配的，用 LLM 生成分類建議                             │    │
│  │  3. 標記置信度                                                  │    │
│  │                                                                  │    │
│  │  輸出:                                                          │    │
│  │  ┌────────────────────────────────────────────────────────────┐ │    │
│  │  │ Term              │ Suggested │ Confidence │ Match Type   │ │    │
│  │  │───────────────────┼───────────┼────────────┼──────────────│ │    │
│  │  │ OCEAN FREIGHT     │ Freight   │    100%    │ exact        │ │    │
│  │  │ THC               │ THC       │    100%    │ exact        │ │    │
│  │  │ HANDLING FEE      │ Handling  │     95%    │ pattern      │ │    │
│  │  │ ADMIN CHARGE      │ Docs Fee  │     75%    │ llm          │ │    │
│  │  │ SPECIAL SERVICE   │ ???       │     50%    │ needs_review │ │    │
│  │  └────────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ PHASE 4: 人工審核確認 (重點工作)                                │    │
│  │ ══════════════════════════════                                  │    │
│  │                                                                  │    │
│  │  只需要審核:                                                    │    │
│  │  • Confidence < 90% 的映射                                      │    │
│  │  • 標記為 "needs_review" 的術語                                 │    │
│  │  • 出現頻率 > 5 次但無法自動匹配的術語                          │    │
│  │                                                                  │    │
│  │  預計: 全部術語的 20-30% 需要人工確認                           │    │
│  │        約 200-400 條需要人工審核                                │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ PHASE 5: 生成最終 Mapping 表 (自動化)                           │    │
│  │ ══════════════════════════════                                  │    │
│  │                                                                  │    │
│  │  • 確認的映射寫入 Database                                      │    │
│  │  • 按 Forwarder 分組                                            │    │
│  │  • 記錄出現頻率（用於優先級排序）                               │    │
│  │  • 生成 Mapping 報告                                            │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 成本效益分析

### 批量處理成本

| 項目 | 數量 | 單價 | 成本 |
|------|------|------|------|
| Azure Doc Intelligence | 2,230 文件 × 2 頁 = 4,460 頁 | $0.01/頁 | **$44.60** |
| Azure OpenAI (LLM 分類) | ~1,000 次調用 | ~$0.01/次 | **~$10** |
| 人工審核 | ~300 條 × 2 分鐘 | - | **10 小時** |
| **總計** | | | **~$55 + 10 小時** |

### ROI 分析

| 場景 | 成本 | 風險 |
|------|------|------|
| **不做批量預處理** | 省 $55 | 上線後每週花 2-3 小時處理未知術語，持續 3-6 個月 |
| **做批量預處理** | $55 + 10 小時 | 上線後幾乎不需要處理未知術語 |

**結論：$55 + 10 小時的一次性投入，換取 3-6 個月的穩定運行，絕對值得！**

---

## 技術實現方案

### 方案 A: n8n 批量處理工作流

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    n8n BATCH PROCESSING WORKFLOW                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐  │
│  │ Read File  │───▶│  Azure     │───▶│  Parse &   │───▶│  Save to   │  │
│  │ List       │    │ Doc Intel  │    │  Extract   │    │  Database  │  │
│  │            │    │  API       │    │  Terms     │    │            │  │
│  └────────────┘    └────────────┘    └────────────┘    └────────────┘  │
│       │                                                      │          │
│       │                                                      ▼          │
│       │            ┌────────────┐    ┌────────────┐    ┌────────────┐  │
│       │            │  Generate  │◀───│  Aggregate │◀───│  All Done? │  │
│       │            │  Report    │    │  & Dedup   │    │            │  │
│       │            └────────────┘    └────────────┘    └────────────┘  │
│       │                                                                 │
│       └─────────────────── Loop until all files processed ─────────────┘
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 方案 B: Python 批量處理腳本

```python
"""
批量處理歷史發票，提取所有術語並生成 Mapping 建議
"""

import os
import json
import asyncio
from collections import defaultdict
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential
from openai import AzureOpenAI
import pandas as pd
from tqdm import tqdm

class HistoricalInvoiceProcessor:
    """歷史發票批量處理器"""
    
    def __init__(self, config):
        self.azure_client = DocumentIntelligenceClient(
            endpoint=config['azure_endpoint'],
            credential=AzureKeyCredential(config['azure_key'])
        )
        self.openai_client = AzureOpenAI(
            azure_endpoint=config['openai_endpoint'],
            api_key=config['openai_key'],
            api_version="2024-02-15-preview"
        )
        
        # 存儲結果
        self.all_terms = defaultdict(lambda: defaultdict(int))  # {forwarder: {term: count}}
        self.extraction_results = []
        self.failed_files = []
    
    async def process_all_files(self, file_list: list, batch_size: int = 10):
        """
        批量處理所有文件
        
        Args:
            file_list: 文件路徑列表，格式為 [(path, forwarder_code), ...]
            batch_size: 並行處理的批次大小
        """
        
        total = len(file_list)
        print(f"開始處理 {total} 個文件...")
        
        # 分批處理
        for i in tqdm(range(0, total, batch_size), desc="Processing batches"):
            batch = file_list[i:i+batch_size]
            tasks = [self._process_single_file(path, forwarder) for path, forwarder in batch]
            await asyncio.gather(*tasks, return_exceptions=True)
            
            # 每 100 個文件保存一次中間結果
            if (i + batch_size) % 100 == 0:
                self._save_checkpoint(i + batch_size)
        
        print(f"處理完成！成功: {len(self.extraction_results)}, 失敗: {len(self.failed_files)}")
    
    async def _process_single_file(self, file_path: str, forwarder_code: str):
        """處理單個文件"""
        
        try:
            # 調用 Azure Doc Intelligence
            with open(file_path, 'rb') as f:
                poller = self.azure_client.begin_analyze_document(
                    'prebuilt-invoice', f
                )
                result = poller.result()
            
            # 提取 Line Items
            line_items = []
            if result.documents:
                doc = result.documents[0]
                if 'Items' in doc.fields:
                    for item in doc.fields['Items'].value:
                        if 'Description' in item.value:
                            description = item.value['Description'].content
                            amount = item.value.get('Amount', {}).get('content')
                            
                            # 標準化術語
                            normalized = self._normalize_term(description)
                            
                            line_items.append({
                                'original': description,
                                'normalized': normalized,
                                'amount': amount
                            })
                            
                            # 記錄術語頻率
                            self.all_terms[forwarder_code][normalized] += 1
            
            # 保存結果
            self.extraction_results.append({
                'file': file_path,
                'forwarder': forwarder_code,
                'line_items': line_items,
                'invoice_number': doc.fields.get('InvoiceId', {}).get('content') if result.documents else None
            })
            
        except Exception as e:
            self.failed_files.append({
                'file': file_path,
                'forwarder': forwarder_code,
                'error': str(e)
            })
    
    def _normalize_term(self, term: str) -> str:
        """標準化術語"""
        import re
        
        # 轉大寫
        normalized = term.upper().strip()
        
        # 移除多餘空格
        normalized = re.sub(r'\s+', ' ', normalized)
        
        # 移除金額和數字（保留術語本身）
        normalized = re.sub(r'\$[\d,\.]+', '', normalized)
        normalized = re.sub(r'[\d,\.]+\s*(USD|HKD|CNY|EUR)?', '', normalized)
        
        # 移除括號內的數量信息
        normalized = re.sub(r'\([^)]*\d+[^)]*\)', '', normalized)
        
        return normalized.strip()
    
    def generate_term_summary(self) -> pd.DataFrame:
        """生成術語彙總報告"""
        
        rows = []
        for forwarder, terms in self.all_terms.items():
            forwarder_total = sum(terms.values())
            
            for term, count in terms.items():
                rows.append({
                    'Forwarder': forwarder,
                    'Term': term,
                    'Count': count,
                    'Percentage': f"{count / forwarder_total * 100:.1f}%"
                })
        
        df = pd.DataFrame(rows)
        df = df.sort_values(['Forwarder', 'Count'], ascending=[True, False])
        
        return df
    
    def generate_unique_terms_by_forwarder(self) -> dict:
        """按 Forwarder 生成唯一術語列表"""
        
        result = {}
        for forwarder, terms in self.all_terms.items():
            # 按出現頻率排序
            sorted_terms = sorted(terms.items(), key=lambda x: -x[1])
            result[forwarder] = [
                {'term': term, 'count': count}
                for term, count in sorted_terms
            ]
        
        return result
    
    async def auto_classify_terms(self, universal_mapping: dict) -> pd.DataFrame:
        """自動分類所有術語"""
        
        all_results = []
        
        for forwarder, terms in self.all_terms.items():
            for term, count in terms.items():
                # 嘗試用通用映射匹配
                match_result = self._try_universal_match(term, universal_mapping)
                
                if match_result['confidence'] >= 0.9:
                    # 高置信度，直接使用
                    all_results.append({
                        'Forwarder': forwarder,
                        'Term': term,
                        'Count': count,
                        'Suggested_Category': match_result['category'],
                        'Confidence': match_result['confidence'],
                        'Match_Type': match_result['type'],
                        'Needs_Review': False
                    })
                else:
                    # 低置信度，使用 LLM
                    llm_result = await self._llm_classify(term, forwarder)
                    all_results.append({
                        'Forwarder': forwarder,
                        'Term': term,
                        'Count': count,
                        'Suggested_Category': llm_result['category'],
                        'Confidence': llm_result['confidence'],
                        'Match_Type': 'llm',
                        'Needs_Review': llm_result['confidence'] < 0.85
                    })
        
        return pd.DataFrame(all_results)
    
    def _try_universal_match(self, term: str, universal_mapping: dict) -> dict:
        """嘗試用通用映射匹配"""
        
        import re
        from rapidfuzz import fuzz
        
        best_match = {'category': None, 'confidence': 0, 'type': 'none'}
        
        for category, rules in universal_mapping.items():
            # 精確匹配
            if term in rules.get('keywords', []):
                return {'category': category, 'confidence': 1.0, 'type': 'exact'}
            
            # 模式匹配
            for pattern in rules.get('patterns', []):
                if re.search(pattern, term, re.IGNORECASE):
                    if best_match['confidence'] < 0.95:
                        best_match = {'category': category, 'confidence': 0.95, 'type': 'pattern'}
            
            # 模糊匹配
            for keyword in rules.get('keywords', []):
                score = fuzz.ratio(term, keyword) / 100
                if score > best_match['confidence'] and score >= 0.8:
                    best_match = {'category': category, 'confidence': score, 'type': 'fuzzy'}
        
        return best_match
    
    async def _llm_classify(self, term: str, forwarder: str) -> dict:
        """使用 LLM 分類"""
        
        prompt = f"""
        將以下運費術語分類到 SCM 標準分類：
        
        術語: "{term}"
        來源: {forwarder}
        
        標準分類包括: Freight, BAF, Delivery, Gate charge, THC, Detention/Demurrage, 
        Devanning cost, Clearance, Docs Fee, Handling, Terminal Fees, EBS, LSS, PSC,
        Cleaning at origin, Others Local Charge, 等等。
        
        如果無法確定，回覆 "UNKNOWN"。
        
        回覆 JSON: {{"category": "分類名稱", "confidence": 0.0-1.0, "reasoning": "理由"}}
        """
        
        response = self.openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        
        result = json.loads(response.choices[0].message.content)
        return result
    
    def _save_checkpoint(self, processed_count: int):
        """保存中間結果"""
        
        checkpoint = {
            'processed_count': processed_count,
            'all_terms': dict(self.all_terms),
            'failed_files': self.failed_files
        }
        
        with open(f'checkpoint_{processed_count}.json', 'w') as f:
            json.dump(checkpoint, f, indent=2, ensure_ascii=False)
    
    def export_results(self, output_dir: str):
        """導出所有結果"""
        
        import os
        os.makedirs(output_dir, exist_ok=True)
        
        # 1. 術語彙總
        term_summary = self.generate_term_summary()
        term_summary.to_excel(f'{output_dir}/term_summary.xlsx', index=False)
        
        # 2. 按 Forwarder 分組的術語
        unique_terms = self.generate_unique_terms_by_forwarder()
        with open(f'{output_dir}/terms_by_forwarder.json', 'w') as f:
            json.dump(unique_terms, f, indent=2, ensure_ascii=False)
        
        # 3. 失敗文件列表
        if self.failed_files:
            pd.DataFrame(self.failed_files).to_excel(f'{output_dir}/failed_files.xlsx', index=False)
        
        # 4. 統計報告
        stats = {
            'total_files': len(self.extraction_results) + len(self.failed_files),
            'successful': len(self.extraction_results),
            'failed': len(self.failed_files),
            'total_forwarders': len(self.all_terms),
            'total_unique_terms': sum(len(terms) for terms in self.all_terms.values()),
            'terms_per_forwarder': {
                forwarder: len(terms) 
                for forwarder, terms in self.all_terms.items()
            }
        }
        
        with open(f'{output_dir}/processing_stats.json', 'w') as f:
            json.dump(stats, f, indent=2, ensure_ascii=False)
        
        print(f"結果已導出到 {output_dir}/")
        return stats


# ===== 使用示例 =====

async def main():
    """主程序"""
    
    # 配置
    config = {
        'azure_endpoint': os.environ['AZURE_DOC_INTEL_ENDPOINT'],
        'azure_key': os.environ['AZURE_DOC_INTEL_KEY'],
        'openai_endpoint': os.environ['AZURE_OPENAI_ENDPOINT'],
        'openai_key': os.environ['AZURE_OPENAI_KEY']
    }
    
    # 讀取文件列表（從你的 Excel 中）
    file_df = pd.read_excel('Book12.xlsx')
    
    # 解析文件名，提取 Forwarder
    import re
    file_list = []
    for filename in file_df['Title']:
        match = re.match(r'^([A-Za-z\s]+)_', filename)
        if match:
            forwarder = match.group(1).strip().upper()
            file_path = f'/path/to/invoices/{filename}'  # 替換為實際路徑
            file_list.append((file_path, forwarder))
    
    # 處理所有文件
    processor = HistoricalInvoiceProcessor(config)
    await processor.process_all_files(file_list, batch_size=10)
    
    # 導出結果
    stats = processor.export_results('output/preprocessing_results')
    
    print("\n處理統計:")
    print(f"  成功處理: {stats['successful']} 文件")
    print(f"  處理失敗: {stats['failed']} 文件")
    print(f"  總 Forwarder: {stats['total_forwarders']} 個")
    print(f"  總唯一術語: {stats['total_unique_terms']} 個")


if __name__ == '__main__':
    asyncio.run(main())
```

---

## 優化建議：分階段處理

### 考慮到成本和效率，建議分階段進行

```
┌─────────────────────────────────────────────────────────────────────────┐
│              PHASED PROCESSING APPROACH                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 1: 優先處理高頻 Forwarder (覆蓋 85% 業務)                        │
│  ═════════════════════════════════════════════                          │
│                                                                          │
│  Forwarder    │ 文件數 │ 佔比   │ 優先級                                │
│  ─────────────┼────────┼────────┼───────                                │
│  RIL          │   512  │ 23.0%  │  P1                                   │
│  TOLL         │   368  │ 16.5%  │  P1                                   │
│  WK           │   346  │ 15.5%  │  P1                                   │
│  MTL          │   186  │  8.3%  │  P1                                   │
│  NEX          │   134  │  6.0%  │  P1                                   │
│  CEVA         │    96  │  4.3%  │  P1                                   │
│  DHL          │    88  │  3.9%  │  P1                                   │
│  NIPPON       │    69  │  3.1%  │  P1                                   │
│  WORLDWIDE    │    57  │  2.6%  │  P1                                   │
│  CYTS         │    47  │  2.1%  │  P1                                   │
│  ─────────────┼────────┼────────┼───────                                │
│  小計         │ ~1,900 │  85%   │                                       │
│                                                                          │
│  成本: ~$40 | 時間: 2-3 小時                                            │
│                                                                          │
│  PHASE 2: 處理剩餘 Forwarder (15% 業務)                                 │
│  ═════════════════════════════════════════                              │
│                                                                          │
│  剩餘 ~35 個 Forwarder, ~330 文件                                       │
│  成本: ~$7 | 時間: 1 小時                                               │
│                                                                          │
│  可選: 上線後再處理，或直接用通用規則 + LLM                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 人工審核界面設計

### 批量審核 UI

```
┌─────────────────────────────────────────────────────────────────────────┐
│              MAPPING REVIEW INTERFACE                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Filter: [All Forwarders ▼] [Needs Review Only ☑] [Confidence < 90% ☑]  │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │ # │ Forwarder │ Original Term         │ Suggested  │ Conf │ Action│  │
│  │───┼───────────┼───────────────────────┼────────────┼──────┼───────│  │
│  │ 1 │ TOLL      │ DELIVERY ORDER RELEASE│ Delivery   │ 75%  │ [✓][✗]│  │
│  │   │           │                       │ [Delivery ▼]│      │ [Edit]│  │
│  │───┼───────────┼───────────────────────┼────────────┼──────┼───────│  │
│  │ 2 │ CEVA      │ ADMIN CHARGE          │ Docs Fee   │ 70%  │ [✓][✗]│  │
│  │   │           │                       │ [Docs Fee▼]│      │ [Edit]│  │
│  │───┼───────────┼───────────────────────┼────────────┼──────┼───────│  │
│  │ 3 │ RIL       │ SPECIAL HANDLING      │ Handling   │ 65%  │ [✓][✗]│  │
│  │   │           │                       │ [Handling▼]│      │ [Edit]│  │
│  │───┼───────────┼───────────────────────┼────────────┼──────┼───────│  │
│  │ 4 │ WK        │ 其他雜費              │ Others...  │ 60%  │ [✓][✗]│  │
│  │   │           │                       │ [Others ▼] │      │ [Edit]│  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  [Approve All High Confidence (>85%)]  [Export to Excel]  [Save Changes] │
│                                                                          │
│  Progress: 156 / 412 reviewed (38%)                                      │
│  ████████████░░░░░░░░░░░░░░░░░░░░                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 預期產出

### 處理 2,230 份文件後，你會得到：

| 產出 | 說明 |
|------|------|
| **terms_by_forwarder.json** | 每個 Forwarder 的所有術語及出現頻率 |
| **term_summary.xlsx** | 所有術語的彙總表（約 1,000-1,500 個唯一術語） |
| **classification_suggestions.xlsx** | AI 分類建議（含置信度） |
| **needs_review.xlsx** | 需要人工審核的術語（約 200-400 條） |
| **final_mapping.xlsx** | 審核後的最終映射表 |

### 預期術語分布

```
┌─────────────────────────────────────────────────────────────────────────┐
│              EXPECTED TERM DISTRIBUTION                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                  │    │
│  │   總唯一術語: ~1,200 個                                         │    │
│  │                                                                  │    │
│  │   ├── 通用術語 (多個 Forwarder 共用): ~200 個                   │    │
│  │   │   └── 例: OCEAN FREIGHT, THC, DRAYAGE                       │    │
│  │   │                                                              │    │
│  │   ├── Forwarder 特定術語: ~800 個                               │    │
│  │   │   └── 例: TOLL PRIORITY SERVICE, CEVA ADMIN FEE             │    │
│  │   │                                                              │    │
│  │   └── 罕見/特殊術語: ~200 個                                    │    │
│  │       └── 例: 特殊服務、一次性費用                               │    │
│  │                                                                  │    │
│  │   自動分類成功率預估:                                           │    │
│  │   ├── 高置信度 (>90%): ~70% = ~840 個                           │    │
│  │   ├── 中置信度 (70-90%): ~20% = ~240 個                         │    │
│  │   └── 需人工審核 (<70%): ~10% = ~120 個                         │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 總結

### 你的想法是對的！

| 問題 | 答案 |
|------|------|
| 應該處理全部歷史數據嗎？ | **是的，這是正確的策略** |
| 會不會太耗時？ | **不會，批量自動化處理只需 2-4 小時** |
| 成本高嗎？ | **約 $55 USD，非常值得** |
| 人工工作量大嗎？ | **約 10 小時審核，只需處理 ~300 條低置信度映射** |

### 建議執行順序

1. **先處理 Top 10 Forwarder** (~1,900 文件，85% 覆蓋)
2. **建立基礎 Mapping 表**
3. **上線 POC 測試**
4. **再處理剩餘 Forwarder**
5. **持續優化**

需要我幫你準備執行這個批量處理的具體腳本嗎？
