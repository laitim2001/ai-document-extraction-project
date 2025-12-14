# 項目流程分析與建議
## 基於你的理解進行優化

---

## 整體評估

| 階段 | 你的理解 | 評估 | 備註 |
|------|---------|------|------|
| 第一階段 | 歷史文件數據初始化 | ✅ 正確，但有優化空間 | 不需要跑兩次 |
| 第二階段 | 術語彙總與去重 | ✅ 完全正確 | - |
| 第三階段 | AI 自動分類建議 | ✅ 正確，可補充 | 建議先建 Universal Mapping |
| 第四階段 | 人工審核確認 | ✅ 完全正確 | - |
| 第五階段 | 正式工作流程 | ✅ 正確，需要細化 | 有幾個技術問題需要解答 |

---

## 第一階段詳細分析

### 你的問題：是否需要跑兩次？

**答案：不需要！** 原因如下：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    為什麼不需要跑兩次？                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  雖然你有 100+ 種不同格式的發票，但 Azure Doc Intelligence              │
│  會將所有格式標準化成統一的 JSON 結構輸出！                              │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                  │    │
│  │   TOLL 格式 ─────┐                                              │    │
│  │                  │                                               │    │
│  │   RIL 格式 ──────┼──▶ Azure Doc Intel ──▶ 統一 JSON 結構        │    │
│  │                  │                                               │    │
│  │   CEVA 格式 ─────┘                                              │    │
│  │                                                                  │    │
│  │   不管輸入什麼格式，輸出都是：                                   │    │
│  │   {                                                              │    │
│  │     "VendorName": "...",                                         │    │
│  │     "InvoiceId": "...",                                          │    │
│  │     "InvoiceTotal": {...},                                       │    │
│  │     "Items": [                                                   │    │
│  │       {"Description": "...", "Amount": ...},                     │    │
│  │       {"Description": "...", "Amount": ...}                      │    │
│  │     ]                                                            │    │
│  │   }                                                              │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  所以數據庫 Schema 可以預先定義，不需要先分析格式！                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 建議的數據庫 Schema（預先定義）

```sql
-- ===== 第一階段用的表 =====

-- 原始提取結果表（存儲 Azure 返回的原始數據）
CREATE TABLE extraction_raw (
    id SERIAL PRIMARY KEY,
    
    -- 文件信息
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000),
    forwarder_code VARCHAR(50),           -- 從文件名解析
    location_code VARCHAR(10),            -- HEX, HIM, CEX, CIM
    
    -- Azure 提取的 Header（標準化字段）
    vendor_name VARCHAR(500),
    invoice_number VARCHAR(100),
    invoice_date DATE,
    total_amount DECIMAL(15,2),
    currency VARCHAR(10),
    
    -- Line Items（用 JSONB 存儲，靈活處理不同數量的項目）
    line_items JSONB,
    -- 格式: [{"description": "...", "amount": 123.45}, ...]
    
    -- Azure 原始返回（完整保留，方便日後重新處理）
    azure_raw_response JSONB,
    
    -- 提取質量
    extraction_confidence DECIMAL(3,2),
    page_count INT,
    
    -- 狀態
    status VARCHAR(20) DEFAULT 'extracted',  -- extracted, processed, failed
    error_message TEXT,
    
    -- 時間戳
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- Line Items 展開表（用於術語分析）
CREATE TABLE extracted_line_items (
    id SERIAL PRIMARY KEY,
    extraction_id INT REFERENCES extraction_raw(id),
    
    -- 原始數據
    original_description VARCHAR(1000),
    original_amount DECIMAL(15,2),
    original_currency VARCHAR(10),
    
    -- 標準化後
    normalized_description VARCHAR(1000),  -- 轉大寫、去空格等
    
    -- 來源信息
    forwarder_code VARCHAR(50),
    
    -- 後續分類用
    scm_category VARCHAR(100),             -- 第三階段填充
    classification_confidence DECIMAL(3,2),
    classification_method VARCHAR(20),
    is_reviewed BOOLEAN DEFAULT false,
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- 創建索引
CREATE INDEX idx_raw_forwarder ON extraction_raw(forwarder_code);
CREATE INDEX idx_raw_status ON extraction_raw(status);
CREATE INDEX idx_items_normalized ON extracted_line_items(normalized_description);
CREATE INDEX idx_items_forwarder ON extracted_line_items(forwarder_code);
```

### 優化後的第一階段流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│              PHASE 1: 歷史文件數據初始化 (優化版)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Step 1.1: 準備工作 (30 分鐘)                                           │
│  ════════════════════════════                                           │
│  • 建立數據庫和表結構（上面的 Schema）                                  │
│  • 準備 Azure Doc Intelligence 資源                                     │
│  • 準備文件列表（你的 Book12.xlsx）                                     │
│                                                                          │
│  Step 1.2: 從文件名解析元數據 (自動化, 5 分鐘)                          │
│  ════════════════════════════════════════════                           │
│  TOLL_HEX240565_89136.pdf                                               │
│       │    │                                                             │
│       │    └── Location: HEX (HK Export)                                │
│       └─────── Forwarder: TOLL                                          │
│                                                                          │
│  • 這一步不需要 OCR，只是解析文件名                                     │
│  • 建立 forwarder_code 和 location_code                                 │
│                                                                          │
│  Step 1.3: 批量 OCR 提取 (自動化, 2-4 小時)                             │
│  ════════════════════════════════════════════                           │
│  • 並行調用 Azure Doc Intelligence                                      │
│  • 每個文件提取 Header + Line Items                                     │
│  • 保存到 extraction_raw 表                                             │
│  • 同時展開 Line Items 到 extracted_line_items 表                       │
│                                                                          │
│  Step 1.4: 質量檢查 (30 分鐘)                                           │
│  ════════════════════════════                                           │
│  • 檢查提取失敗的文件                                                   │
│  • 統計各 Forwarder 的提取成功率                                        │
│  • 抽樣驗證提取準確性                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 第二階段補充

你的理解完全正確，補充一個產出示例：

```
┌─────────────────────────────────────────────────────────────────────────┐
│              PHASE 2 產出示例                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  查詢: 按 Forwarder 統計唯一術語                                        │
│                                                                          │
│  SELECT                                                                  │
│      forwarder_code,                                                    │
│      normalized_description,                                            │
│      COUNT(*) as occurrence_count                                       │
│  FROM extracted_line_items                                              │
│  GROUP BY forwarder_code, normalized_description                        │
│  ORDER BY forwarder_code, occurrence_count DESC;                        │
│                                                                          │
│  產出示例:                                                              │
│  ┌────────────┬──────────────────────────────┬───────────┬─────────┐   │
│  │ Forwarder  │ Term                         │ Count     │ % 出現  │   │
│  ├────────────┼──────────────────────────────┼───────────┼─────────┤   │
│  │ TOLL       │ OCEAN FREIGHT                │    368    │  100%   │   │
│  │ TOLL       │ THC                          │    365    │   99%   │   │
│  │ TOLL       │ DELIVERY                     │    320    │   87%   │   │
│  │ TOLL       │ HANDLING FEE                 │    245    │   67%   │   │
│  │ TOLL       │ DOCUMENTATION FEE            │    198    │   54%   │   │
│  │ TOLL       │ GATE CHARGE                  │    156    │   42%   │   │
│  │ TOLL       │ DETENTION                    │     52    │   14%   │   │
│  │ TOLL       │ X-RAY CHARGE                 │     18    │    5%   │   │
│  │ TOLL       │ CUSTOMS INSPECTION           │      8    │    2%   │   │
│  │ TOLL       │ REEFER SURCHARGE             │      3    │   <1%   │   │
│  ├────────────┼──────────────────────────────┼───────────┼─────────┤   │
│  │ TOLL 小計  │ 45 種唯一術語                │   1,733   │         │   │
│  ├────────────┼──────────────────────────────┼───────────┼─────────┤   │
│  │ RIL        │ OCEAN FREIGHT                │    512    │  100%   │   │
│  │ RIL        │ TERMINAL HANDLING CHARGE     │    498    │   97%   │   │
│  │ ...        │ ...                          │    ...    │   ...   │   │
│  └────────────┴──────────────────────────────┴───────────┴─────────┘   │
│                                                                          │
│  總結:                                                                  │
│  • 45 個 Forwarder                                                      │
│  • ~1,200 個唯一術語                                                    │
│  • 每個 Forwarder 平均 25-30 種術語                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 第三階段補充

### 建議：先準備 Universal Mapping 再讓 AI 分類

```
┌─────────────────────────────────────────────────────────────────────────┐
│              PHASE 3: 優化建議                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  你的想法: 讓 AI 在沒有 Data Mapping 的情況下直接分類                    │
│                                                                          │
│  我的建議: 先準備 Universal Mapping，再讓 AI 分類                        │
│                                                                          │
│  原因:                                                                  │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                  │    │
│  │  沒有 Universal Mapping 的情況:                                 │    │
│  │  • AI 可能使用不同的分類名稱 (e.g., "運費" vs "Freight")        │    │
│  │  • 難以保證一致性                                               │    │
│  │  • 後續人工審核工作量大                                         │    │
│  │                                                                  │    │
│  │  有 Universal Mapping 的情況:                                   │    │
│  │  • AI 有明確的分類選項，結果更一致                              │    │
│  │  • 可以先用規則匹配 70% 的術語                                  │    │
│  │  • AI 只需處理 30% 難以匹配的術語                               │    │
│  │  • 人工審核工作量大幅減少                                       │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  建議的 Phase 3 流程:                                                   │
│                                                                          │
│  Step 3.1: 準備 Universal Mapping (人工, 4-8 小時)                      │
│  ════════════════════════════════════════════════                       │
│  • 整理 80 個 SCM Header 的定義                                         │
│  • 收集行業通用術語 (約 200-300 個)                                     │
│  • 建立 Keyword → Category 的映射                                       │
│                                                                          │
│  Step 3.2: 規則匹配 (自動化, 10 分鐘)                                   │
│  ════════════════════════════════════                                   │
│  • 用 Universal Mapping 匹配所有術語                                    │
│  • 預計可以匹配 60-70% 的術語                                           │
│                                                                          │
│  Step 3.3: AI 分類剩餘術語 (自動化, 30 分鐘)                            │
│  ════════════════════════════════════════════                           │
│  • 只對未匹配的 30-40% 術語使用 AI                                      │
│  • AI 從 80 個 SCM Header 中選擇                                        │
│  • 節省 AI 調用成本                                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 第五階段詳細分析

### 你的問題 1: 如何判斷文件是已知類型還是新類型？

```
┌─────────────────────────────────────────────────────────────────────────┐
│              文件類型識別策略                                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  根據你的數據，文件名已經包含了 Forwarder 信息！                        │
│                                                                          │
│  TOLL_HEX240565_89136.pdf                                               │
│  ^^^^                                                                    │
│  直接從文件名提取 Forwarder Code                                        │
│                                                                          │
│  識別流程:                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                  │    │
│  │  新文件上傳到 Blob Storage                                      │    │
│  │         │                                                        │    │
│  │         ▼                                                        │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │ Step 1: 從文件名提取 Forwarder Code                     │    │    │
│  │  │         TOLL_HEX240565.pdf → "TOLL"                     │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  │         │                                                        │    │
│  │         ▼                                                        │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │ Step 2: 查詢 Database 是否有該 Forwarder 的 Mapping     │    │    │
│  │  │         SELECT * FROM forwarder_mappings                │    │    │
│  │  │         WHERE forwarder_code = 'TOLL'                   │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  │         │                                                        │    │
│  │         ├── 有記錄 ──▶ 已知類型 ──▶ 使用現有 Mapping           │    │
│  │         │                                                        │    │
│  │         └── 無記錄 ──▶ 新類型 ──▶ 標記為需要建立 Mapping       │    │
│  │                        │                                         │    │
│  │                        ▼                                         │    │
│  │                  可以選擇:                                       │    │
│  │                  a) 暫時用 Universal Mapping + AI                │    │
│  │                  b) 加入人工審核隊列                              │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  如果文件名不規範（沒有 Forwarder 前綴）:                               │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                  │    │
│  │  Fallback 識別策略:                                             │    │
│  │                                                                  │    │
│  │  1. 先 OCR 提取文字                                             │    │
│  │  2. 在 Header 區域搜索已知 Forwarder 關鍵字                     │    │
│  │  3. 匹配發票號碼格式                                            │    │
│  │  4. 如果還是無法識別，用 AI 判斷                                │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 你的問題 2: 傳給 AI 是用 PDF 還是圖像？如何轉換？

```
┌─────────────────────────────────────────────────────────────────────────┐
│              PDF vs 圖像 - 詳細解答                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    不同場景的選擇                                │    │
│  │                                                                  │    │
│  │  場景 1: Azure Document Intelligence                            │    │
│  │  ─────────────────────────────────                              │    │
│  │  • 直接傳 PDF ✓                                                 │    │
│  │  • 不需要轉換                                                   │    │
│  │  • 支持格式: PDF, JPEG, PNG, BMP, TIFF, HEIF                    │    │
│  │                                                                  │    │
│  │  場景 2: GPT-4o / GPT-4 Vision                                  │    │
│  │  ─────────────────────────────────                              │    │
│  │  • 需要轉換成圖像 ⚠️                                            │    │
│  │  • 支持格式: JPEG, PNG, GIF, WEBP                               │    │
│  │  • 不直接支持 PDF                                               │    │
│  │                                                                  │    │
│  │  場景 3: Claude (Anthropic)                                     │    │
│  │  ─────────────────────────────                                  │    │
│  │  • 可以直接傳 PDF ✓ (最新版本支持)                              │    │
│  │  • 也可以傳圖像                                                 │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    建議的處理流程                                │    │
│  │                                                                  │    │
│  │  主流程: Azure Doc Intelligence (直接用 PDF)                    │    │
│  │       │                                                          │    │
│  │       ├── 成功且高置信度 ──▶ 直接使用結果                       │    │
│  │       │                                                          │    │
│  │       └── 失敗或低置信度 ──▶ 轉換成圖像 ──▶ 調用 GPT-4o        │    │
│  │                                                                  │    │
│  │  這樣大部分文件不需要轉換，只有少數需要 AI 輔助的才轉換         │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### PDF 轉圖像的方法

```python
# ===== 方法 1: 使用 pdf2image (推薦) =====

from pdf2image import convert_from_path, convert_from_bytes
import io
import base64

def pdf_to_images(pdf_path: str, dpi: int = 200) -> list:
    """
    將 PDF 轉換為圖像列表
    
    Args:
        pdf_path: PDF 文件路徑
        dpi: 解析度，建議 150-200 (太高會太大，太低會模糊)
    
    Returns:
        PIL Image 列表，每頁一個
    """
    images = convert_from_path(pdf_path, dpi=dpi)
    return images


def pdf_to_base64_images(pdf_path: str, dpi: int = 200) -> list:
    """
    將 PDF 轉換為 Base64 編碼的圖像（用於發送給 GPT-4o）
    """
    images = convert_from_path(pdf_path, dpi=dpi)
    
    base64_images = []
    for img in images:
        # 轉換為 JPEG bytes
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=85)
        buffer.seek(0)
        
        # 編碼為 Base64
        base64_str = base64.b64encode(buffer.read()).decode('utf-8')
        base64_images.append(base64_str)
    
    return base64_images


# ===== 方法 2: 使用 PyMuPDF (fitz) =====

import fitz  # PyMuPDF

def pdf_to_images_fitz(pdf_path: str, dpi: int = 200) -> list:
    """
    使用 PyMuPDF 將 PDF 轉換為圖像
    （比 pdf2image 快，但需要額外安裝）
    """
    doc = fitz.open(pdf_path)
    images = []
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        
        # 設置縮放比例 (72 是 PDF 的標準 DPI)
        zoom = dpi / 72
        matrix = fitz.Matrix(zoom, zoom)
        
        # 渲染為圖像
        pix = page.get_pixmap(matrix=matrix)
        
        # 轉換為 PIL Image
        from PIL import Image
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        images.append(img)
    
    doc.close()
    return images


# ===== 發送給 GPT-4o 的示例 =====

from openai import AzureOpenAI

def analyze_invoice_with_gpt4o(pdf_path: str, prompt: str) -> dict:
    """
    使用 GPT-4o Vision 分析發票
    """
    client = AzureOpenAI(
        azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
        api_key=os.environ["AZURE_OPENAI_KEY"],
        api_version="2024-02-15-preview"
    )
    
    # 將 PDF 轉換為 Base64 圖像
    base64_images = pdf_to_base64_images(pdf_path, dpi=150)
    
    # 構建消息（包含圖像）
    content = [{"type": "text", "text": prompt}]
    
    for i, img_base64 in enumerate(base64_images):
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:image/jpeg;base64,{img_base64}",
                "detail": "high"  # 或 "low" 以節省 token
            }
        })
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": content
            }
        ],
        max_tokens=4000
    )
    
    return response.choices[0].message.content
```

### 在 n8n 中轉換 PDF 的方法

```
┌─────────────────────────────────────────────────────────────────────────┐
│              n8n 中處理 PDF 轉圖像                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  方法 1: 調用後端 API (推薦)                                            │
│  ════════════════════════════                                           │
│                                                                          │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐                    │
│  │ n8n        │───▶│ 後端 API   │───▶│ 返回       │                    │
│  │ HTTP Node  │    │ /convert   │    │ Base64 Img │                    │
│  └────────────┘    └────────────┘    └────────────┘                    │
│                                                                          │
│  後端 API 示例 (FastAPI):                                               │
│  ```python                                                              │
│  @app.post("/api/convert-pdf-to-image")                                 │
│  async def convert_pdf(file: UploadFile):                               │
│      contents = await file.read()                                       │
│      images = convert_from_bytes(contents, dpi=150)                     │
│      base64_images = [img_to_base64(img) for img in images]             │
│      return {"images": base64_images}                                   │
│  ```                                                                    │
│                                                                          │
│  方法 2: n8n Code Node (需要 Docker 配置)                               │
│  ════════════════════════════════════════                               │
│                                                                          │
│  n8n 的 Code Node 可以運行 Python，但需要在 Docker 中                    │
│  安裝 pdf2image 和 poppler-utils：                                      │
│                                                                          │
│  Dockerfile:                                                            │
│  ```                                                                    │
│  FROM n8nio/n8n                                                         │
│  USER root                                                              │
│  RUN apt-get update && apt-get install -y poppler-utils                 │
│  RUN pip install pdf2image pillow                                       │
│  USER node                                                              │
│  ```                                                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 完整的第五階段流程圖

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           PHASE 5: 正式工作流程 (完整版)                             │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                          TRIGGER: 新文件上傳                                 │    │
│  │                                                                              │    │
│  │   Azure Blob Storage ──── Event Grid ────▶ n8n Webhook                      │    │
│  │   (檢測到新文件)          (觸發事件)        (開始處理)                        │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                           │                                          │
│                                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                       STEP 1: 解析文件名，識別 Forwarder                     │    │
│  │                                                                              │    │
│  │   TOLL_HEX240565_89136.pdf                                                  │    │
│  │        │     │                                                               │    │
│  │        │     └── Location: HEX                                              │    │
│  │        └──────── Forwarder: TOLL                                            │    │
│  │                                                                              │    │
│  │   查詢 DB: SELECT COUNT(*) FROM forwarder_mappings WHERE code = 'TOLL'      │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                          │                              │                            │
│                          ▼                              ▼                            │
│              ┌──────────────────────┐      ┌──────────────────────┐                 │
│              │   已知 Forwarder     │      │   未知 Forwarder     │                 │
│              │   (有 Mapping)       │      │   (無 Mapping)       │                 │
│              └──────────────────────┘      └──────────────────────┘                 │
│                          │                              │                            │
│                          ▼                              ▼                            │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                       STEP 2: Azure Doc Intelligence 提取                    │    │
│  │                                                                              │    │
│  │   ┌────────────┐                       ┌────────────────────────────────┐   │    │
│  │   │   PDF      │─── 直接傳送 ─────────▶│   Azure Document Intelligence  │   │    │
│  │   │   文件     │   (不需要轉換)        │   (prebuilt-invoice 模型)      │   │    │
│  │   └────────────┘                       └────────────────────────────────┘   │    │
│  │                                                     │                        │    │
│  │                                                     ▼                        │    │
│  │                                        ┌────────────────────────┐            │    │
│  │                                        │ 返回 JSON:             │            │    │
│  │                                        │ • VendorName           │            │    │
│  │                                        │ • InvoiceId            │            │    │
│  │                                        │ • InvoiceTotal         │            │    │
│  │                                        │ • Items[]              │            │    │
│  │                                        │ • Confidence Scores    │            │    │
│  │                                        └────────────────────────┘            │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                           │                                          │
│                                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                       STEP 3: 提取質量檢查                                   │    │
│  │                                                                              │    │
│  │   檢查項目:                                                                  │    │
│  │   • Invoice Number 是否提取成功？                                           │    │
│  │   • Total Amount 是否提取成功？                                             │    │
│  │   • Line Items 數量是否合理？(至少 1 個)                                    │    │
│  │   • 整體 Confidence 是否 > 70%？                                            │    │
│  │                                                                              │    │
│  │   計算: extraction_score = 各項評分加權平均                                  │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                          │                              │                            │
│           extraction_score >= 70%          extraction_score < 70%                    │
│                          │                              │                            │
│                          ▼                              ▼                            │
│              ┌──────────────────────┐      ┌──────────────────────────────────┐     │
│              │   提取成功           │      │   提取不佳，需要 AI 輔助         │     │
│              │   繼續分類流程       │      └──────────────────────────────────┘     │
│              └──────────────────────┘                   │                            │
│                          │                              ▼                            │
│                          │         ┌──────────────────────────────────────────┐     │
│                          │         │   STEP 3b: AI 輔助提取                   │     │
│                          │         │                                          │     │
│                          │         │   1. PDF 轉換為圖像 (pdf2image)          │     │
│                          │         │   2. 發送給 GPT-4o Vision                │     │
│                          │         │   3. Prompt: "請提取發票中的所有費用項目" │     │
│                          │         │   4. 解析 AI 返回的結果                  │     │
│                          │         └──────────────────────────────────────────┘     │
│                          │                              │                            │
│                          ▼                              ▼                            │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                       STEP 4: 費用分類 (Data Mapping)                        │    │
│  │                                                                              │    │
│  │   For each line_item in extracted_items:                                    │    │
│  │                                                                              │    │
│  │   ┌──────────────────────────────────────────────────────────────────────┐  │    │
│  │   │ Layer 1: Forwarder-Specific Mapping (如果是已知 Forwarder)           │  │    │
│  │   │          查詢: SELECT scm_category FROM forwarder_mappings            │  │    │
│  │   │                WHERE forwarder_code = 'TOLL'                          │  │    │
│  │   │                AND original_term = 'OCEAN FREIGHT'                    │  │    │
│  │   │          如果匹配 → confidence = 1.0 → 跳過後續層                     │  │    │
│  │   └──────────────────────────────────────────────────────────────────────┘  │    │
│  │                              │ (無匹配)                                      │    │
│  │                              ▼                                               │    │
│  │   ┌──────────────────────────────────────────────────────────────────────┐  │    │
│  │   │ Layer 2: Universal Mapping (通用規則)                                │  │    │
│  │   │          精確匹配 + 模糊匹配 + 正則匹配                               │  │    │
│  │   │          如果匹配 → confidence = 0.85-0.99                           │  │    │
│  │   └──────────────────────────────────────────────────────────────────────┘  │    │
│  │                              │ (無匹配或低置信度)                            │    │
│  │                              ▼                                               │    │
│  │   ┌──────────────────────────────────────────────────────────────────────┐  │    │
│  │   │ Layer 3: LLM Classification (AI 分類)                                │  │    │
│  │   │          Prompt: "將 '{term}' 分類到以下 80 個類別之一: ..."         │  │    │
│  │   │          confidence = AI 返回的置信度 (通常 0.7-0.9)                 │  │    │
│  │   └──────────────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                           │                                          │
│                                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                       STEP 5: 整體置信度評估                                 │    │
│  │                                                                              │    │
│  │   overall_score = (                                                          │    │
│  │       extraction_score × 0.4 +                                              │    │
│  │       classification_score × 0.4 +                                          │    │
│  │       validation_score × 0.2                                                 │    │
│  │   )                                                                          │    │
│  │                                                                              │    │
│  │   validation_score = 檢查 line_items 總和是否接近 invoice_total             │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                           │                                          │
│              ┌────────────────────────────┼────────────────────────────┐             │
│              │                            │                            │             │
│              ▼                            ▼                            ▼             │
│   ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐          │
│   │ Score >= 90%     │      │ Score 70-89%     │      │ Score < 70%      │          │
│   │                  │      │                  │      │                  │          │
│   │ AUTO APPROVE     │      │ QUICK REVIEW     │      │ MANUAL REVIEW    │          │
│   │ 自動通過         │      │ 快速審核         │      │ 人工審核         │          │
│   └──────────────────┘      └──────────────────┘      └──────────────────┘          │
│              │                            │                            │             │
│              ▼                            ▼                            ▼             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                       STEP 6: 保存到統一數據表                               │    │
│  │                                                                              │    │
│  │   INSERT INTO invoices_final (                                              │    │
│  │       forwarder, invoice_number, invoice_date, total_amount, currency,      │    │
│  │       freight, baf, delivery, thc, handling, ...(80 個統一字段)...          │    │
│  │       extraction_confidence, classification_confidence, overall_score,       │    │
│  │       status, reviewed_by, reviewed_at                                       │    │
│  │   )                                                                          │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                           │                                          │
│                                           ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                       STEP 7: 後續動作                                       │    │
│  │                                                                              │    │
│  │   • 自動通過 → 標記完成，可進入報表                                         │    │
│  │   • 需審核 → 發送通知到 Teams/Email，加入審核隊列                           │    │
│  │   • 新 Forwarder → 收集該類型的術語，準備建立新 Mapping                     │    │
│  │                                                                              │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 最終數據表設計 (80 個統一字段)

```sql
-- 最終的統一發票數據表
CREATE TABLE invoices_final (
    id SERIAL PRIMARY KEY,
    
    -- ===== 來源信息 =====
    file_name VARCHAR(500),
    file_path VARCHAR(1000),
    forwarder_code VARCHAR(50),
    forwarder_name VARCHAR(200),
    location_code VARCHAR(10),
    
    -- ===== Header 信息 =====
    invoice_number VARCHAR(100),
    invoice_date DATE,
    due_date DATE,
    po_number VARCHAR(100),
    shipment_ref VARCHAR(100),
    
    -- ===== 運輸信息 =====
    transport_mode VARCHAR(20),        -- sea, air, land
    origin VARCHAR(100),
    destination VARCHAR(100),
    container_number VARCHAR(50),
    bl_number VARCHAR(50),
    
    -- ===== 金額匯總 =====
    total_amount DECIMAL(15,2),
    subtotal DECIMAL(15,2),
    tax_amount DECIMAL(15,2),
    currency VARCHAR(10),
    
    -- ===== 80 個統一費用字段 =====
    -- 運費相關
    freight DECIMAL(15,2),
    freight_currency VARCHAR(10),
    baf DECIMAL(15,2),                 -- Bunker Adjustment Factor
    
    -- 陸運/交付相關
    delivery DECIMAL(15,2),
    car_park_fee DECIMAL(15,2),
    gate_charge DECIMAL(15,2),
    bridge_toll_fee DECIMAL(15,2),
    tunnel_fee DECIMAL(15,2),
    others_delivery DECIMAL(15,2),
    
    -- 碼頭/倉儲相關
    thc DECIMAL(15,2),                 -- Terminal Handling Charge
    detention_demurrage DECIMAL(15,2),
    yard_storage DECIMAL(15,2),
    yard_handling DECIMAL(15,2),
    cfs DECIMAL(15,2),
    wh_container_facility_fee DECIMAL(15,2),
    devanning_cost DECIMAL(15,2),
    
    -- 關稅/清關相關
    duty DECIMAL(15,2),
    clearance DECIMAL(15,2),
    declaration_fee DECIMAL(15,2),
    
    -- 文件/處理費
    docs_fee DECIMAL(15,2),
    handling DECIMAL(15,2),
    terminal_fees DECIMAL(15,2),
    
    -- 附加費
    ebs DECIMAL(15,2),
    lss DECIMAL(15,2),
    psc DECIMAL(15,2),
    
    -- 其他費用
    container_pickup_return_surcharge DECIMAL(15,2),
    it_trans DECIMAL(15,2),
    qshe_fee DECIMAL(15,2),
    others_local_charge DECIMAL(15,2),
    
    -- 起運地費用 (at origin)
    terminal_fees_at_origin DECIMAL(15,2),
    docs_fee_at_origin DECIMAL(15,2),
    clearance_at_origin DECIMAL(15,2),
    handling_at_origin DECIMAL(15,2),
    port_tax_at_origin DECIMAL(15,2),
    vgm_at_origin DECIMAL(15,2),
    pick_up_fee_at_origin DECIMAL(15,2),
    fuel_surcharge_at_origin DECIMAL(15,2),
    security_surcharge_at_origin DECIMAL(15,2),
    xray_at_origin DECIMAL(15,2),
    container_rental_at_origin DECIMAL(15,2),
    qp_charge_at_origin DECIMAL(15,2),
    rocars_at_origin DECIMAL(15,2),
    customs_inspection_at_origin DECIMAL(15,2),
    gate_charge_at_origin DECIMAL(15,2),
    cleaning_at_origin DECIMAL(15,2),
    
    -- ... 其他字段根據實際需要添加 ...
    
    -- ===== 處理狀態 =====
    extraction_confidence DECIMAL(3,2),
    classification_confidence DECIMAL(3,2),
    overall_score DECIMAL(3,2),
    
    status VARCHAR(20),                -- pending, approved, rejected, manual_review
    review_status VARCHAR(30),         -- auto_approved, quick_review, detailed_review
    
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    
    -- ===== 原始數據 (用於追溯) =====
    raw_line_items JSONB,              -- 原始提取的 line items
    classification_details JSONB,       -- 每個 item 的分類詳情
    
    -- ===== 時間戳 =====
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

-- 索引
CREATE INDEX idx_final_forwarder ON invoices_final(forwarder_code);
CREATE INDEX idx_final_date ON invoices_final(invoice_date);
CREATE INDEX idx_final_status ON invoices_final(status);
CREATE INDEX idx_final_score ON invoices_final(overall_score);
```

---

## 總結

### 你的理解評估

| 階段 | 評估 | 需要調整的地方 |
|------|------|---------------|
| 第一階段 | ✅ 正確 | 不需要跑兩次，Azure 輸出是標準化的 |
| 第二階段 | ✅ 完全正確 | 無 |
| 第三階段 | ✅ 正確 | 建議先準備 Universal Mapping |
| 第四階段 | ✅ 完全正確 | 無 |
| 第五階段 | ✅ 正確 | 已解答 PDF 轉圖像的問題 |

### 關鍵答案

| 問題 | 答案 |
|------|------|
| 數據庫 Schema 需要跑兩次嗎？ | **不需要**，Azure 輸出是標準化的 JSON |
| 如何識別文件類型？ | **從文件名解析** + 查詢 DB 是否有 Mapping |
| AI 要傳 PDF 還是圖像？ | **Azure Doc Intel 直接傳 PDF**，GPT-4o 需要轉圖像 |
| 如何轉換 PDF 到圖像？ | 使用 **pdf2image** 或 **PyMuPDF** |

需要我進一步細化哪個部分？
