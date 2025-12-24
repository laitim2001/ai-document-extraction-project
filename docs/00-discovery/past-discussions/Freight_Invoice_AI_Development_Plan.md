# Freight Invoice AI 智能處理系統
## 完整開發計劃與技術方案

---

## 1. 系統架構總覽

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FREIGHT INVOICE AI PLATFORM                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐              │
│  │   INPUT LAYER   │    │  PROCESSING     │    │   OUTPUT LAYER  │              │
│  │                 │    │  ENGINE         │    │                 │              │
│  │  • Email (IMAP) │───▶│                 │───▶│  • SCM Excel    │              │
│  │  • PDF Upload   │    │  n8n Orchestr.  │    │  • Power BI     │              │
│  │  • Scan/Photo   │    │       +         │    │  • DocuWare     │              │
│  │  • DocuWare API │    │  AI Engine      │    │  • Audit Portal │              │
│  └─────────────────┘    └────────┬────────┘    └─────────────────┘              │
│                                  │                                               │
│  ┌───────────────────────────────┼───────────────────────────────────────────┐  │
│  │                    AI PROCESSING PIPELINE                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │   STEP 1     │  │   STEP 2     │  │   STEP 3     │  │   STEP 4     │   │  │
│  │  │  Document    │─▶│    Data      │─▶│   Cost       │─▶│  Confidence  │   │  │
│  │  │  Analysis    │  │  Extraction  │  │ Classification│  │   Scoring    │   │  │
│  │  │              │  │              │  │              │  │              │   │  │
│  │  │ • Type       │  │ • Azure Doc  │  │ • Rule-based │  │ • Auto-pass  │   │  │
│  │  │ • Forwarder  │  │   Intell.    │  │ • Fuzzy      │  │ • Review     │   │  │
│  │  │ • Quality    │  │ • LLM Assist │  │ • LLM        │  │ • Reject     │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │                         DATA LAYER                                         │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │  PostgreSQL  │  │ Azure Blob   │  │  Mapping     │  │  Audit       │   │  │
│  │  │  Database    │  │  Storage     │  │  Rules DB    │  │  Logs        │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 文件類型處理策略

### 2.1 支援的文件類型

| 文件類型 | 來源 | 品質等級 | 處理策略 | 預期準確度 |
|---------|------|---------|---------|-----------|
| **電子 PDF** | Email / 系統生成 | ⭐⭐⭐⭐⭐ | Azure Doc Intelligence (prebuilt-invoice) | 95-99% |
| **掃描 PDF** | 掃描機 / 影印機 | ⭐⭐⭐⭐ | Azure Doc Intelligence + 增強 OCR | 85-95% |
| **手機拍照** | 手機相機 | ⭐⭐⭐ | 預處理 + Azure Doc Intelligence | 75-90% |
| **手寫文件** | 手動填寫 | ⭐⭐ | Azure Read API + LLM 輔助 | 60-80% |
| **傳真/影印** | FAX / 複印 | ⭐⭐ | 預處理增強 + Azure Doc Intelligence | 70-85% |

### 2.2 文件品質預處理 Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DOCUMENT PRE-PROCESSING PIPELINE                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │  Input   │───▶│  Format  │───▶│  Image   │───▶│  Quality │          │
│  │  File    │    │  Detect  │    │  Enhance │    │  Score   │          │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘          │
│       │               │               │               │                 │
│       ▼               ▼               ▼               ▼                 │
│  • PDF             • PDF           • Deskew        • Resolution        │
│  • JPG/PNG         • Image         • Denoise       • Clarity           │
│  • TIFF            • Multi-page    • Contrast      • Text Density      │
│  • HEIC            • Scanned       • Sharpen       • Overall Score     │
│                    • Native        • Binarize                           │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Python 預處理代碼示例：

```python
import cv2
import numpy as np
from PIL import Image
from pdf2image import convert_from_path

class DocumentPreprocessor:
    """文件預處理器 - 提升OCR準確度"""
    
    def __init__(self):
        self.quality_thresholds = {
            'excellent': 90,
            'good': 75,
            'fair': 60,
            'poor': 40
        }
    
    def process_document(self, file_path: str) -> dict:
        """主入口：處理文件並返回增強後的圖像"""
        
        # 1. 檢測文件類型
        file_type = self._detect_file_type(file_path)
        
        # 2. 轉換為圖像
        images = self._convert_to_images(file_path, file_type)
        
        # 3. 評估原始品質
        original_quality = self._assess_quality(images[0])
        
        # 4. 根據品質決定增強策略
        enhanced_images = []
        for img in images:
            if original_quality['score'] < 75:
                img = self._enhance_image(img, original_quality)
            enhanced_images.append(img)
        
        # 5. 重新評估品質
        final_quality = self._assess_quality(enhanced_images[0])
        
        return {
            'images': enhanced_images,
            'original_quality': original_quality,
            'final_quality': final_quality,
            'file_type': file_type,
            'page_count': len(images),
            'needs_manual_review': final_quality['score'] < 60
        }
    
    def _detect_file_type(self, file_path: str) -> str:
        """檢測文件類型和來源"""
        import magic
        mime = magic.Magic(mime=True)
        file_mime = mime.from_file(file_path)
        
        if 'pdf' in file_mime:
            # 進一步判斷是電子PDF還是掃描PDF
            return self._classify_pdf(file_path)
        elif 'image' in file_mime:
            return 'image'
        return 'unknown'
    
    def _classify_pdf(self, file_path: str) -> str:
        """區分電子PDF和掃描PDF"""
        import fitz  # PyMuPDF
        doc = fitz.open(file_path)
        
        text_content = ""
        for page in doc:
            text_content += page.get_text()
        
        # 如果能直接提取大量文字，則為電子PDF
        if len(text_content.strip()) > 100:
            return 'pdf_native'
        return 'pdf_scanned'
    
    def _enhance_image(self, img: np.ndarray, quality: dict) -> np.ndarray:
        """根據品質問題應用相應的增強策略"""
        
        # 1. 灰度化
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img
        
        # 2. 去噪
        if quality.get('noise_level', 0) > 30:
            gray = cv2.fastNlMeansDenoising(gray, h=10)
        
        # 3. 傾斜校正
        if quality.get('skew_angle', 0) > 1:
            gray = self._deskew(gray)
        
        # 4. 對比度增強
        if quality.get('contrast', 100) < 80:
            gray = cv2.equalizeHist(gray)
        
        # 5. 銳化
        if quality.get('sharpness', 100) < 70:
            kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
            gray = cv2.filter2D(gray, -1, kernel)
        
        # 6. 二值化（適用於表格/文字）
        gray = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 11, 2
        )
        
        return gray
    
    def _assess_quality(self, img: np.ndarray) -> dict:
        """評估圖像品質"""
        
        # 轉灰度
        if len(img.shape) == 3:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        else:
            gray = img
        
        # 1. 解析度評分
        height, width = gray.shape[:2]
        resolution_score = min(100, (width * height) / (1000 * 1000) * 50)
        
        # 2. 清晰度評分 (Laplacian variance)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        sharpness_score = min(100, laplacian_var / 10)
        
        # 3. 對比度評分
        contrast = gray.std()
        contrast_score = min(100, contrast * 2)
        
        # 4. 噪聲評分
        noise_level = self._estimate_noise(gray)
        noise_score = max(0, 100 - noise_level)
        
        # 5. 傾斜角度
        skew_angle = self._detect_skew(gray)
        skew_score = max(0, 100 - abs(skew_angle) * 10)
        
        # 綜合評分
        overall_score = (
            resolution_score * 0.15 +
            sharpness_score * 0.30 +
            contrast_score * 0.25 +
            noise_score * 0.15 +
            skew_score * 0.15
        )
        
        return {
            'score': round(overall_score, 1),
            'resolution': resolution_score,
            'sharpness': sharpness_score,
            'contrast': contrast_score,
            'noise_level': noise_level,
            'skew_angle': skew_angle,
            'quality_grade': self._get_grade(overall_score)
        }
    
    def _get_grade(self, score: float) -> str:
        if score >= 90: return 'excellent'
        if score >= 75: return 'good'
        if score >= 60: return 'fair'
        return 'poor'
```

---

## 3. Forwarder 識別機制

### 3.1 識別策略（多層次）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FORWARDER IDENTIFICATION PIPELINE                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ Layer 1: EMAIL METADATA (Confidence: 95-100%)                  │     │
│  │ ─────────────────────────────────────────────────────────────  │     │
│  │ • Sender domain: @ceva.com → CEVA Logistics                    │     │
│  │ • Sender domain: @nippon-express.com → Nippon Express          │     │
│  │ • Email subject patterns                                        │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                              │                                           │
│                              ▼ (if not matched)                         │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ Layer 2: INVOICE HEADER DETECTION (Confidence: 90-98%)         │     │
│  │ ─────────────────────────────────────────────────────────────  │     │
│  │ • Logo recognition (Azure Custom Vision)                        │     │
│  │ • Company name in header text                                   │     │
│  │ • Invoice number prefix patterns                                │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                              │                                           │
│                              ▼ (if not matched)                         │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ Layer 3: CONTENT ANALYSIS (Confidence: 80-95%)                 │     │
│  │ ─────────────────────────────────────────────────────────────  │     │
│  │ • Bank account matching                                         │     │
│  │ • Address/contact info matching                                 │     │
│  │ • Fee terminology patterns unique to forwarder                  │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                              │                                           │
│                              ▼ (if not matched)                         │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ Layer 4: LLM INFERENCE (Confidence: 70-90%)                    │     │
│  │ ─────────────────────────────────────────────────────────────  │     │
│  │ • Send invoice image/text to GPT-5.2/Claude                      │     │
│  │ • Ask: "Identify the freight forwarder from this invoice"       │     │
│  │ • Cross-reference with known forwarder list                     │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                              │                                           │
│                              ▼ (if still not matched)                   │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │ Layer 5: MANUAL ASSIGNMENT                                      │     │
│  │ ─────────────────────────────────────────────────────────────  │     │
│  │ • Flag for human review                                         │     │
│  │ • SCM specialist assigns forwarder                              │     │
│  │ • Learn from correction for future                              │     │
│  └────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Forwarder 主數據表設計

```sql
CREATE TABLE forwarders (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,        -- e.g., 'CEVA', 'NIPPON', 'TOLL'
    name VARCHAR(200) NOT NULL,               -- Full company name
    short_name VARCHAR(50),                   -- Display name
    
    -- Identification Patterns
    email_domains TEXT[],                     -- ['@ceva.com', '@cevalogistics.com']
    invoice_number_patterns TEXT[],           -- ['^CEVA-\d+', '^INV\d{6}$']
    logo_signatures JSONB,                    -- Azure Custom Vision model IDs
    bank_accounts TEXT[],                     -- For matching
    
    -- Invoice Format Hints
    invoice_format_type VARCHAR(50),          -- 'structured', 'semi-structured', 'free-form'
    typical_line_item_count INT,              -- Helps validate extraction
    currency_default VARCHAR(3),              -- Default currency if not detected
    
    -- Terminology Mapping
    terminology_profile_id INT,               -- Link to terminology mapping
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 已知 Forwarder 初始數據
INSERT INTO forwarders (code, name, short_name, email_domains, invoice_number_patterns) VALUES
('CEVA', 'CEVA Logistics', 'CEVA', ARRAY['@ceva.com', '@cevalogistics.com'], ARRAY['^[A-Z]{2}\d{8}$']),
('NIPPON', 'Nippon Express', 'Nippon', ARRAY['@nippon-express.com', '@nittsu.com'], ARRAY['^NE\d+$']),
('TOLL', 'Toll Global Forwarding', 'TOLL', ARRAY['@tollgroup.com'], ARRAY['^TL[A-Z]{2}\d{8}$']),
('WK', 'Wang Kay Logistics', 'WK', ARRAY['@wangkay.com'], ARRAY['^W-[A-Z]{2}-\d{4}-\d{3}$']),
('RIL', 'Ricoh International Logistics', 'RIL', ARRAY['@ril.com'], ARRAY['^\d{7}$']),
('MAINFREIGHT', 'Mainfreight', 'Mainfreight', ARRAY['@mainfreight.com'], ARRAY['^MF\d+$']);
```

### 3.3 Forwarder 識別代碼

```python
class ForwarderIdentifier:
    """多層次 Forwarder 識別器"""
    
    def __init__(self, db_connection, llm_client):
        self.db = db_connection
        self.llm = llm_client
        self.forwarders = self._load_forwarders()
    
    def identify(self, document: dict) -> dict:
        """
        識別 Forwarder
        
        Args:
            document: {
                'email_from': str,           # 發件人郵箱
                'email_subject': str,        # 郵件主題
                'extracted_text': str,       # OCR 提取的文字
                'invoice_number': str,       # 發票號碼
                'image_path': str            # 文件圖像路徑
            }
        
        Returns:
            {
                'forwarder_code': str,
                'forwarder_name': str,
                'confidence': float,
                'identification_method': str,
                'needs_review': bool
            }
        """
        
        results = []
        
        # Layer 1: Email Domain Matching
        if document.get('email_from'):
            result = self._match_by_email(document['email_from'])
            if result:
                results.append({**result, 'method': 'email_domain', 'confidence': 0.98})
        
        # Layer 2: Invoice Number Pattern
        if document.get('invoice_number'):
            result = self._match_by_invoice_number(document['invoice_number'])
            if result:
                results.append({**result, 'method': 'invoice_pattern', 'confidence': 0.95})
        
        # Layer 3: Header Text Analysis
        if document.get('extracted_text'):
            result = self._match_by_header_text(document['extracted_text'])
            if result:
                results.append({**result, 'method': 'header_text', 'confidence': 0.90})
        
        # Layer 4: Bank Account Matching
        if document.get('extracted_text'):
            result = self._match_by_bank_account(document['extracted_text'])
            if result:
                results.append({**result, 'method': 'bank_account', 'confidence': 0.92})
        
        # Layer 5: LLM Inference (if no high-confidence match)
        if not results or max(r['confidence'] for r in results) < 0.85:
            result = self._identify_by_llm(document)
            if result:
                results.append({**result, 'method': 'llm_inference'})
        
        # Select best result
        if results:
            best = max(results, key=lambda x: x['confidence'])
            return {
                'forwarder_code': best['code'],
                'forwarder_name': best['name'],
                'confidence': best['confidence'],
                'identification_method': best['method'],
                'needs_review': best['confidence'] < 0.85,
                'all_matches': results
            }
        
        # No match found
        return {
            'forwarder_code': None,
            'forwarder_name': 'UNKNOWN',
            'confidence': 0,
            'identification_method': 'none',
            'needs_review': True
        }
    
    def _match_by_email(self, email: str) -> dict:
        """通過郵箱域名匹配"""
        domain = email.split('@')[-1].lower()
        
        for forwarder in self.forwarders:
            for pattern in forwarder['email_domains']:
                if domain in pattern.lower() or pattern.lower() in domain:
                    return {'code': forwarder['code'], 'name': forwarder['name']}
        return None
    
    def _match_by_invoice_number(self, invoice_number: str) -> dict:
        """通過發票號碼格式匹配"""
        import re
        
        for forwarder in self.forwarders:
            for pattern in forwarder.get('invoice_number_patterns', []):
                if re.match(pattern, invoice_number, re.IGNORECASE):
                    return {'code': forwarder['code'], 'name': forwarder['name']}
        return None
    
    def _match_by_header_text(self, text: str) -> dict:
        """通過發票頭部文字匹配"""
        text_upper = text.upper()
        
        # 檢查公司名稱是否出現在前500個字符內（通常是header區域）
        header_text = text_upper[:500]
        
        for forwarder in self.forwarders:
            if forwarder['name'].upper() in header_text:
                return {'code': forwarder['code'], 'name': forwarder['name']}
            if forwarder.get('short_name') and forwarder['short_name'].upper() in header_text:
                return {'code': forwarder['code'], 'name': forwarder['name']}
        
        return None
    
    def _identify_by_llm(self, document: dict) -> dict:
        """使用 LLM 推斷 Forwarder"""
        
        forwarder_list = [f"{f['code']} - {f['name']}" for f in self.forwarders]
        
        prompt = f"""Analyze this freight invoice and identify the freight forwarder/logistics company.

Known forwarders in our system:
{chr(10).join(forwarder_list)}

Invoice text (first 2000 chars):
{document.get('extracted_text', '')[:2000]}

Invoice number: {document.get('invoice_number', 'N/A')}

Respond in JSON format:
{{
    "forwarder_code": "CODE or UNKNOWN",
    "forwarder_name": "Full name",
    "confidence": 0.0 to 1.0,
    "reasoning": "Brief explanation"
}}
"""
        
        response = self.llm.chat.completions.create(
            model="gpt-5.2",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        result = json.loads(response.choices[0].message.content)
        return {
            'code': result['forwarder_code'],
            'name': result['forwarder_name'],
            'confidence': result['confidence']
        }
```

---

## 4. 數據提取策略

### 4.1 提取架構

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      DATA EXTRACTION PIPELINE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    AZURE DOCUMENT INTELLIGENCE                   │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │    │
│  │  │ prebuilt-invoice│  │  prebuilt-read  │  │  custom-model   │  │    │
│  │  │ (電子PDF首選)   │  │  (手寫/低品質)  │  │  (特定格式)     │  │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    EXTRACTION RESULTS                            │    │
│  │  • Header Fields: Vendor, Invoice#, Date, Total, Currency        │    │
│  │  • Line Items: Description, Amount, Quantity, Unit Price         │    │
│  │  • Tables: All detected tables with row/column structure         │    │
│  │  • Raw Text: Full OCR text for fallback processing               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    LLM ENHANCEMENT LAYER                         │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │ When to Use LLM:                                         │    │    │
│  │  │ • Azure extraction confidence < 80%                      │    │    │
│  │  │ • Missing critical fields (invoice#, total, etc.)        │    │    │
│  │  │ • Handwritten content detected                           │    │    │
│  │  │ • Complex/unusual invoice format                         │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Azure Document Intelligence 調用

```python
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential
import os

class InvoiceDataExtractor:
    """發票數據提取器"""
    
    def __init__(self):
        self.endpoint = os.environ["AZURE_DOC_INTEL_ENDPOINT"]
        self.key = os.environ["AZURE_DOC_INTEL_KEY"]
        self.client = DocumentIntelligenceClient(
            endpoint=self.endpoint,
            credential=AzureKeyCredential(self.key)
        )
    
    def extract_invoice(self, file_path: str, document_type: str = 'auto') -> dict:
        """
        提取發票數據
        
        Args:
            file_path: 文件路徑
            document_type: 'native_pdf', 'scanned', 'image', 'handwritten'
        
        Returns:
            提取結果字典
        """
        
        # 選擇最適合的模型
        model_id = self._select_model(document_type)
        
        with open(file_path, "rb") as f:
            # 提交分析請求
            poller = self.client.begin_analyze_document(
                model_id=model_id,
                body=f,
                content_type="application/pdf" if file_path.endswith('.pdf') else "image/jpeg"
            )
            result = poller.result()
        
        # 解析結果
        extracted_data = self._parse_result(result)
        
        # 如果提取不完整，使用 LLM 增強
        if self._needs_llm_enhancement(extracted_data):
            extracted_data = self._enhance_with_llm(extracted_data, result.content)
        
        return extracted_data
    
    def _select_model(self, document_type: str) -> str:
        """根據文件類型選擇模型"""
        model_map = {
            'native_pdf': 'prebuilt-invoice',
            'scanned': 'prebuilt-invoice',
            'image': 'prebuilt-invoice',
            'handwritten': 'prebuilt-read',  # 手寫用 Read 模型
            'auto': 'prebuilt-invoice'
        }
        return model_map.get(document_type, 'prebuilt-invoice')
    
    def _parse_result(self, result) -> dict:
        """解析 Azure 返回結果"""
        
        extracted = {
            'header': {},
            'line_items': [],
            'tables': [],
            'raw_text': result.content,
            'confidence_scores': {},
            'extraction_method': 'azure_doc_intelligence'
        }
        
        if not result.documents:
            return extracted
        
        doc = result.documents[0]
        fields = doc.fields
        
        # 提取 Header 字段
        header_mappings = {
            'VendorName': 'vendor_name',
            'VendorAddress': 'vendor_address',
            'CustomerName': 'customer_name',
            'CustomerAddress': 'customer_address',
            'InvoiceId': 'invoice_number',
            'InvoiceDate': 'invoice_date',
            'DueDate': 'due_date',
            'PurchaseOrder': 'po_number',
            'ShippingAddress': 'shipping_address',
            'InvoiceTotal': 'total_amount',
            'SubTotal': 'subtotal',
            'TotalTax': 'tax_amount',
            'AmountDue': 'amount_due'
        }
        
        for azure_field, our_field in header_mappings.items():
            if azure_field in fields and fields[azure_field]:
                field = fields[azure_field]
                value = self._extract_field_value(field)
                confidence = field.confidence if hasattr(field, 'confidence') else 0
                
                extracted['header'][our_field] = value
                extracted['confidence_scores'][our_field] = confidence
        
        # 提取貨幣
        if 'InvoiceTotal' in fields and fields['InvoiceTotal']:
            total_field = fields['InvoiceTotal']
            if hasattr(total_field, 'value') and hasattr(total_field.value, 'currency_code'):
                extracted['header']['currency'] = total_field.value.currency_code
        
        # 提取 Line Items
        if 'Items' in fields and fields['Items']:
            for item in fields['Items'].value:
                line_item = {}
                item_fields = item.value
                
                item_mappings = {
                    'Description': 'description',
                    'Amount': 'amount',
                    'Quantity': 'quantity',
                    'UnitPrice': 'unit_price',
                    'ProductCode': 'product_code',
                    'Unit': 'unit'
                }
                
                for azure_field, our_field in item_mappings.items():
                    if azure_field in item_fields:
                        line_item[our_field] = self._extract_field_value(item_fields[azure_field])
                
                if line_item:
                    extracted['line_items'].append(line_item)
        
        # 提取 Tables（用於複雜格式）
        if result.tables:
            for table in result.tables:
                table_data = {
                    'row_count': table.row_count,
                    'column_count': table.column_count,
                    'cells': []
                }
                for cell in table.cells:
                    table_data['cells'].append({
                        'row': cell.row_index,
                        'col': cell.column_index,
                        'content': cell.content,
                        'kind': cell.kind if hasattr(cell, 'kind') else 'content'
                    })
                extracted['tables'].append(table_data)
        
        # 計算整體置信度
        if extracted['confidence_scores']:
            scores = list(extracted['confidence_scores'].values())
            extracted['overall_confidence'] = sum(scores) / len(scores)
        else:
            extracted['overall_confidence'] = 0
        
        return extracted
    
    def _extract_field_value(self, field):
        """提取字段值"""
        if not field:
            return None
        
        if hasattr(field, 'value'):
            value = field.value
            # 處理金額類型
            if hasattr(value, 'amount'):
                return value.amount
            # 處理日期類型
            if hasattr(value, 'isoformat'):
                return value.isoformat()
            return value
        
        if hasattr(field, 'content'):
            return field.content
        
        return str(field)
    
    def _needs_llm_enhancement(self, extracted: dict) -> bool:
        """判斷是否需要 LLM 增強"""
        
        # 關鍵字段缺失
        required_fields = ['invoice_number', 'total_amount', 'vendor_name']
        for field in required_fields:
            if not extracted['header'].get(field):
                return True
        
        # 整體置信度太低
        if extracted.get('overall_confidence', 0) < 0.80:
            return True
        
        # Line items 為空但有 tables
        if not extracted['line_items'] and extracted['tables']:
            return True
        
        return False
    
    def _enhance_with_llm(self, extracted: dict, raw_text: str) -> dict:
        """使用 LLM 增強提取結果"""
        
        from openai import AzureOpenAI
        
        client = AzureOpenAI(
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            api_key=os.environ["AZURE_OPENAI_KEY"],
            api_version="2024-02-15-preview"
        )
        
        prompt = f"""Analyze this freight invoice text and extract the following information.

Invoice Text:
{raw_text[:4000]}

Already extracted (may be incomplete/incorrect):
{json.dumps(extracted['header'], indent=2)}

Please extract or correct:
1. vendor_name: The freight forwarder/logistics company name
2. invoice_number: The invoice/debit note number
3. invoice_date: Invoice date (YYYY-MM-DD format)
4. total_amount: Total amount (number only)
5. currency: Currency code (HKD, USD, CNY, etc.)
6. line_items: Array of {{description, amount}} for each charge

Return JSON format:
{{
    "header": {{...}},
    "line_items": [{{...}}],
    "corrections_made": ["list of corrections"],
    "confidence": 0.0-1.0
}}
"""
        
        response = client.chat.completions.create(
            model="gpt-5.2",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        llm_result = json.loads(response.choices[0].message.content)
        
        # 合併結果
        for key, value in llm_result.get('header', {}).items():
            if value and (not extracted['header'].get(key) or extracted['confidence_scores'].get(key, 0) < 0.8):
                extracted['header'][key] = value
                extracted['confidence_scores'][key] = llm_result.get('confidence', 0.85)
        
        # 補充 line items
        if not extracted['line_items'] and llm_result.get('line_items'):
            extracted['line_items'] = llm_result['line_items']
        
        extracted['llm_enhanced'] = True
        extracted['llm_corrections'] = llm_result.get('corrections_made', [])
        
        return extracted
```

---

## 5. 費用分類匹配系統

### 5.1 SCM 標準分類（80+ Headers）

根據你的實際數據，整理如下分類體系：

```python
SCM_CATEGORIES = {
    # ===== 運費相關 =====
    "Freight": {
        "code": "FRT",
        "group": "運費",
        "description": "海運/空運運費",
        "keywords": ["OCEAN FREIGHT", "SEA FREIGHT", "AIR FREIGHT", "FREIGHT CHARGE", 
                    "EXPRESS BILL OF LADING", "B/L FEE", "OTHER CHARGES"],
        "patterns": [r"freight", r"o/f", r"a/f", r"ocean", r"sea\s*freight"]
    },
    "BAF": {
        "code": "BAF",
        "group": "運費附加",
        "description": "燃油附加費",
        "keywords": ["BAF", "BUNKER ADJUSTMENT", "FUEL ADJUSTMENT"],
        "patterns": [r"baf", r"bunker"]
    },
    
    # ===== 陸運/交付相關 =====
    "Delivery": {
        "code": "DLV",
        "group": "陸運",
        "description": "送貨費/拖車費",
        "keywords": ["DRAYAGE", "TRUCKING", "HAULAGE", "CARTAGE", "TRANSPORT",
                    "DELIVERY CHARGE", "DELIVERY ORDER FEE", "D/O FEE"],
        "patterns": [r"drayage", r"trucking", r"delivery", r"haulage", r"d/o\s*fee"]
    },
    "Car park fee": {
        "code": "CPF",
        "group": "陸運",
        "description": "停車費"
    },
    "Gate charge": {
        "code": "GAT",
        "group": "陸運",
        "description": "閘口費",
        "keywords": ["GATE CHARGE", "GATE FEE", "ENTRY FEE"]
    },
    "Bridge toll fee": {
        "code": "BRG",
        "group": "陸運",
        "description": "過橋費"
    },
    "Tunnel fee": {
        "code": "TNL",
        "group": "陸運",
        "description": "隧道費"
    },
    "Others Delivery": {
        "code": "OTD",
        "group": "陸運",
        "description": "其他交付費用"
    },
    
    # ===== 碼頭/倉儲相關 =====
    "THC": {
        "code": "THC",
        "group": "碼頭",
        "description": "碼頭處理費",
        "keywords": ["THC", "TERMINAL HANDLING CHARGE", "TERMINAL HANDLING"],
        "patterns": [r"thc", r"terminal\s*handling"],
        "note": "不區分 origin/destination，統一用 THC"
    },
    "Detention/Demurrage": {
        "code": "DEM",
        "group": "碼頭",
        "description": "滯箱/滯港費"
    },
    "Yard Storage": {
        "code": "YST",
        "group": "倉儲",
        "description": "堆場存儲費"
    },
    "CFS": {
        "code": "CFS",
        "group": "倉儲",
        "description": "集裝箱貨運站費用"
    },
    "Devanning cost": {
        "code": "DVN",
        "group": "倉儲",
        "description": "拆箱費",
        "keywords": ["VANNING CHARGE", "DEVANNING", "UNSTUFFING", "STUFFING"]
    },
    
    # ===== 關稅/清關相關 =====
    "Duty": {
        "code": "DTY",
        "group": "關稅",
        "description": "關稅"
    },
    "Clearance": {
        "code": "CLR",
        "group": "清關",
        "description": "清關費"
    },
    "Declaration Fee": {
        "code": "DCL",
        "group": "清關",
        "description": "報關費"
    },
    
    # ===== 文件/處理費 =====
    "Docs Fee": {
        "code": "DOC",
        "group": "文件",
        "description": "文件費"
    },
    "Handling": {
        "code": "HDL",
        "group": "處理",
        "description": "處理費",
        "keywords": ["HANDLING CHARGE", "HANDLING FEE", "HANDLING & PROCESSING"]
    },
    "Terminal Fees": {
        "code": "TRM",
        "group": "碼頭",
        "description": "碼頭費用"
    },
    
    # ===== 附加費 =====
    "EBS": {
        "code": "EBS",
        "group": "附加",
        "description": "緊急燃油附加費"
    },
    "LSS": {
        "code": "LSS",
        "group": "附加",
        "description": "低硫附加費"
    },
    "PSC": {
        "code": "PSC",
        "group": "附加",
        "description": "港口擁擠附加費"
    },
    
    # ===== 起運地費用 (at origin) =====
    "Terminal Fees at origin": {"code": "TRO", "group": "起運地"},
    "Docs Fee at origin": {"code": "DCO", "group": "起運地"},
    "Clearance at origin": {"code": "CLO", "group": "起運地"},
    "Handling at origin": {"code": "HLO", "group": "起運地"},
    "Port Tax at origin": {"code": "PTO", "group": "起運地"},
    "VGM at origin": {"code": "VGM", "group": "起運地"},
    "Fuel surcharge at origin": {"code": "FSO", "group": "起運地"},
    "Cleaning at origin": {
        "code": "CLN",
        "group": "起運地",
        "keywords": ["CLEANING", "CONTAINER CLEANING", "CLEANING AT DESTINATION"],
        "note": "所有清潔費都歸到這裡"
    },
    
    # ===== 其他 =====
    "Others Local Charge": {
        "code": "OTL",
        "group": "其他",
        "description": "其他本地費用"
    }
}
```

### 5.2 三層分類引擎

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COST CLASSIFICATION ENGINE                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Input: Line Item Description + Amount + Context                         │
│         Example: "TERMINAL HANDLING CHARGE (ORIGIN)" = 2,500.00          │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ LAYER 1: EXACT MATCH (Confidence: 100%)                         │    │
│  │ ─────────────────────────────────────────────────────────────── │    │
│  │ • Check against exact keyword list                               │    │
│  │ • "TERMINAL HANDLING CHARGE" → exact match → THC                 │    │
│  │ • If matched: STOP, return result                                │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼ (if no exact match)                      │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ LAYER 2: FUZZY + RULE-BASED (Confidence: 85-99%)                │    │
│  │ ─────────────────────────────────────────────────────────────── │    │
│  │ • Regex pattern matching                                         │    │
│  │ • Fuzzy string matching (Levenshtein distance)                   │    │
│  │ • Context-aware rules (transport mode, origin/destination)       │    │
│  │ • Forwarder-specific terminology mapping                         │    │
│  │ • If confidence > 85%: STOP, return result                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼ (if confidence < 85%)                    │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ LAYER 3: LLM CLASSIFICATION (Confidence: 70-95%)                │    │
│  │ ─────────────────────────────────────────────────────────────── │    │
│  │ • Send description + context to GPT-5.2/Claude                    │    │
│  │ • Include SCM category list in prompt                            │    │
│  │ • Ask for classification + confidence + reasoning                │    │
│  │ • Cross-validate with Layer 2 result                             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  Output: {category: "THC", confidence: 0.95, method: "exact_match"}      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.3 分類引擎代碼

```python
import re
from rapidfuzz import fuzz, process
from typing import List, Dict, Optional, Tuple

class CostClassificationEngine:
    """三層費用分類引擎"""
    
    def __init__(self, db_connection, llm_client):
        self.db = db_connection
        self.llm = llm_client
        
        # 載入分類規則
        self.categories = self._load_categories()
        self.forwarder_mappings = self._load_forwarder_mappings()
        self.learned_mappings = self._load_learned_mappings()
    
    def classify(self, description: str, context: dict = None) -> dict:
        """
        分類單個費用項目
        
        Args:
            description: 費用描述文字
            context: {
                'forwarder_code': str,      # 貨代代碼
                'transport_mode': str,       # 'sea', 'air', 'land'
                'amount': float,             # 金額
                'currency': str,             # 貨幣
                'invoice_text': str          # 完整發票文字（用於上下文）
            }
        
        Returns:
            {
                'category': str,             # SCM 分類名稱
                'category_code': str,        # 分類代碼
                'confidence': float,         # 0-1
                'method': str,               # 'exact', 'fuzzy', 'rule', 'llm'
                'needs_review': bool,        # 是否需要人工審核
                'alternative_categories': [] # 其他可能的分類
            }
        """
        
        context = context or {}
        description_clean = self._normalize_description(description)
        
        # Layer 1: Exact Match
        result = self._exact_match(description_clean)
        if result:
            return {**result, 'method': 'exact', 'confidence': 1.0, 'needs_review': False}
        
        # Layer 2: Fuzzy + Rule-based
        result = self._fuzzy_and_rule_match(description_clean, context)
        if result and result['confidence'] >= 0.85:
            return {**result, 'needs_review': result['confidence'] < 0.90}
        
        # 檢查已學習的映射
        learned = self._check_learned_mapping(description_clean, context.get('forwarder_code'))
        if learned and learned['confidence'] >= 0.90:
            return {**learned, 'method': 'learned', 'needs_review': False}
        
        # Layer 3: LLM Classification
        llm_result = self._llm_classify(description_clean, context)
        
        # 如果 Layer 2 和 Layer 3 結果一致，提高置信度
        if result and llm_result['category'] == result['category']:
            final_confidence = min(0.95, (result['confidence'] + llm_result['confidence']) / 2 + 0.1)
            return {
                'category': result['category'],
                'category_code': result['category_code'],
                'confidence': final_confidence,
                'method': 'fuzzy+llm',
                'needs_review': final_confidence < 0.90
            }
        
        return {**llm_result, 'needs_review': llm_result['confidence'] < 0.85}
    
    def classify_batch(self, line_items: List[dict], context: dict = None) -> List[dict]:
        """批量分類"""
        results = []
        for item in line_items:
            result = self.classify(
                item.get('description', ''),
                context={
                    **(context or {}),
                    'amount': item.get('amount'),
                    'currency': item.get('currency')
                }
            )
            results.append({
                'original': item,
                'classification': result
            })
        return results
    
    def _normalize_description(self, description: str) -> str:
        """標準化描述文字"""
        # 轉大寫
        text = description.upper().strip()
        # 移除多餘空格
        text = re.sub(r'\s+', ' ', text)
        # 移除特殊字符但保留必要的
        text = re.sub(r'[^\w\s\-\/\(\)]', '', text)
        return text
    
    def _exact_match(self, description: str) -> Optional[dict]:
        """Layer 1: 精確匹配"""
        
        # 建立精確匹配表
        exact_mappings = {
            # 運費
            'OCEAN FREIGHT': 'Freight',
            'SEA FREIGHT': 'Freight',
            'AIR FREIGHT': 'Freight',
            'EXPRESS BILL OF LADING': 'Freight',
            'OTHER CHARGES': 'Freight',
            
            # 交付
            'DRAYAGE': 'Delivery',
            'TRUCKING': 'Delivery',
            'HAULAGE': 'Delivery',
            'CARTAGE': 'Delivery',
            'DELIVERY ORDER FEE': 'Delivery',
            'D/O FEE': 'Delivery',
            
            # THC（統一處理）
            'THC': 'THC',
            'TERMINAL HANDLING CHARGE': 'THC',
            'TERMINAL HANDLING CHARGE (ORIGIN)': 'THC',
            'TERMINAL HANDLING CHARGE AT DESTINATION': 'THC',
            
            # 其他精確匹配...
            'GATE CHARGE': 'Gate charge',
            'VANNING CHARGE': 'Devanning cost',
            'DEVANNING': 'Devanning cost',
            'CLEANING': 'Cleaning at origin',
            'CLEANING CONTAINER': 'Cleaning at origin',
            'CLEANING AT DESTINATION': 'Cleaning at origin',
        }
        
        if description in exact_mappings:
            category = exact_mappings[description]
            return {
                'category': category,
                'category_code': self.categories[category]['code']
            }
        
        # 檢查包含關係
        for keyword, category in exact_mappings.items():
            if keyword in description:
                return {
                    'category': category,
                    'category_code': self.categories[category]['code']
                }
        
        return None
    
    def _fuzzy_and_rule_match(self, description: str, context: dict) -> Optional[dict]:
        """Layer 2: 模糊匹配 + 規則"""
        
        best_match = None
        best_score = 0
        
        # 遍歷所有分類的關鍵字
        for category_name, category_info in self.categories.items():
            keywords = category_info.get('keywords', [])
            patterns = category_info.get('patterns', [])
            
            # 關鍵字模糊匹配
            for keyword in keywords:
                score = fuzz.ratio(description, keyword.upper())
                if score > best_score and score >= 70:
                    best_score = score
                    best_match = {
                        'category': category_name,
                        'category_code': category_info['code'],
                        'confidence': score / 100,
                        'method': 'fuzzy'
                    }
            
            # 正則模式匹配
            for pattern in patterns:
                if re.search(pattern, description, re.IGNORECASE):
                    pattern_score = 90  # 正則匹配給予較高分數
                    if pattern_score > best_score:
                        best_score = pattern_score
                        best_match = {
                            'category': category_name,
                            'category_code': category_info['code'],
                            'confidence': 0.90,
                            'method': 'pattern'
                        }
        
        # 應用特殊規則
        if best_match:
            best_match = self._apply_special_rules(best_match, description, context)
        
        return best_match
    
    def _apply_special_rules(self, match: dict, description: str, context: dict) -> dict:
        """應用特殊業務規則"""
        
        transport_mode = context.get('transport_mode', 'sea')
        
        # 規則1: THC 不區分 origin/destination
        if 'TERMINAL HANDLING' in description:
            match['category'] = 'THC'
            match['category_code'] = 'THC'
            match['confidence'] = max(match['confidence'], 0.95)
        
        # 規則2: D/O Fee 屬於 Delivery，不是 Docs Fee
        if 'D/O' in description or 'DELIVERY ORDER' in description:
            match['category'] = 'Delivery'
            match['category_code'] = 'DLV'
        
        # 規則3: 空運的 Origin 費用使用 "at origin" 版本
        if transport_mode == 'air' and 'ORIGIN' in description:
            if match['category'] == 'Handling':
                match['category'] = 'Handling at origin'
                match['category_code'] = 'HLO'
            elif match['category'] == 'Terminal Fees':
                match['category'] = 'Terminal Fees at origin'
                match['category_code'] = 'TRO'
        
        # 規則4: 所有 Cleaning 統一用 Cleaning at origin
        if 'CLEANING' in description or 'CLEAN' in description:
            match['category'] = 'Cleaning at origin'
            match['category_code'] = 'CLN'
        
        return match
    
    def _llm_classify(self, description: str, context: dict) -> dict:
        """Layer 3: LLM 分類"""
        
        category_list = "\n".join([
            f"- {name} ({info['code']}): {info.get('description', '')}"
            for name, info in self.categories.items()
        ])
        
        prompt = f"""Classify this freight invoice charge into one of our standard SCM categories.

Charge Description: "{description}"
Amount: {context.get('amount', 'N/A')} {context.get('currency', '')}
Transport Mode: {context.get('transport_mode', 'unknown')}
Forwarder: {context.get('forwarder_code', 'unknown')}

Available Categories:
{category_list}

Important Classification Rules:
1. "D/O Fee" or "Delivery Order Fee" should be classified as "Delivery", NOT "Docs Fee"
2. "Terminal Handling Charge" regardless of origin/destination should be "THC"
3. "Cleaning" fees should always be "Cleaning at origin"
4. "Express Bill of Lading" should be "Freight"

Respond in JSON format:
{{
    "category": "Category Name",
    "category_code": "CODE",
    "confidence": 0.0 to 1.0,
    "reasoning": "Brief explanation",
    "alternative_categories": ["other possible categories"]
}}
"""
        
        response = self.llm.chat.completions.create(
            model="gpt-5.2",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1  # 低溫度確保一致性
        )

        result = json.loads(response.choices[0].message.content)

        return {
            'category': result['category'],
            'category_code': result['category_code'],
            'confidence': result['confidence'],
            'method': 'llm',
            'reasoning': result.get('reasoning'),
            'alternative_categories': result.get('alternative_categories', [])
        }
    
    def _check_learned_mapping(self, description: str, forwarder_code: str) -> Optional[dict]:
        """檢查已學習的映射"""
        
        # 查詢數據庫中的學習記錄
        query = """
        SELECT scm_category, confidence, match_count
        FROM learned_mappings
        WHERE normalized_description = %s
          AND (forwarder_code = %s OR forwarder_code IS NULL)
          AND is_active = true
        ORDER BY match_count DESC, confidence DESC
        LIMIT 1
        """
        
        result = self.db.execute(query, (description, forwarder_code)).fetchone()
        
        if result:
            return {
                'category': result['scm_category'],
                'category_code': self.categories[result['scm_category']]['code'],
                'confidence': result['confidence']
            }
        
        return None
    
    def learn_from_correction(self, original_description: str, 
                              corrected_category: str,
                              forwarder_code: str = None):
        """從人工校正中學習"""
        
        normalized = self._normalize_description(original_description)
        
        # 更新或插入學習記錄
        self.db.execute("""
            INSERT INTO learned_mappings 
            (normalized_description, original_description, scm_category, 
             forwarder_code, confidence, match_count, source)
            VALUES (%s, %s, %s, %s, 1.0, 1, 'human_correction')
            ON CONFLICT (normalized_description, forwarder_code) 
            DO UPDATE SET 
                scm_category = EXCLUDED.scm_category,
                match_count = learned_mappings.match_count + 1,
                confidence = LEAST(1.0, learned_mappings.confidence + 0.05),
                updated_at = NOW()
        """, (normalized, original_description, corrected_category, forwarder_code))
        
        self.db.commit()
```

---

## 6. 評分與置信度機制

### 6.1 評分體系設計

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CONFIDENCE SCORING SYSTEM                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    SCORE COMPONENTS                              │    │
│  │                                                                  │    │
│  │  EXTRACTION SCORE (40%)                                         │    │
│  │  ├── Header fields completeness (15%)                           │    │
│  │  │   └── Invoice#, Date, Total, Vendor = required               │    │
│  │  ├── Azure OCR confidence (15%)                                 │    │
│  │  │   └── Average confidence from Azure Doc Intel                │    │
│  │  └── Line items extraction (10%)                                │    │
│  │      └── % of detectable items successfully extracted           │    │
│  │                                                                  │    │
│  │  CLASSIFICATION SCORE (40%)                                     │    │
│  │  ├── Category mapping confidence (25%)                          │    │
│  │  │   └── Average confidence across all line items               │    │
│  │  └── Rule/LLM agreement (15%)                                   │    │
│  │      └── Bonus if multiple methods agree                        │    │
│  │                                                                  │    │
│  │  VALIDATION SCORE (20%)                                         │    │
│  │  ├── Total validation (10%)                                     │    │
│  │  │   └── Sum of line items ≈ invoice total                      │    │
│  │  └── Format validation (10%)                                    │    │
│  │      └── Invoice# format, date format, currency valid           │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    ROUTING DECISIONS                             │    │
│  │                                                                  │    │
│  │  OVERALL SCORE >= 95%  ──────────────▶  AUTO-APPROVE             │    │
│  │  │                                       (直接進入已完成)         │    │
│  │  │                                                               │    │
│  │  OVERALL SCORE 80-94%  ──────────────▶  QUICK REVIEW             │    │
│  │  │                                       (快速確認介面)           │    │
│  │  │                                                               │    │
│  │  OVERALL SCORE 60-79%  ──────────────▶  DETAILED REVIEW          │    │
│  │  │                                       (詳細審核介面)           │    │
│  │  │                                                               │    │
│  │  OVERALL SCORE < 60%   ──────────────▶  MANUAL PROCESSING        │    │
│  │                                          (需要人工完全處理)       │    │
│  │                                                                  │    │
│  │  ANY CRITICAL ERROR    ──────────────▶  FLAG FOR REVIEW          │    │
│  │  (missing invoice#, total mismatch > 10%, etc.)                  │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.2 評分引擎代碼

```python
from dataclasses import dataclass
from enum import Enum
from typing import List, Dict, Optional
import math

class ReviewStatus(Enum):
    AUTO_APPROVED = "auto_approved"
    QUICK_REVIEW = "quick_review"
    DETAILED_REVIEW = "detailed_review"
    MANUAL_PROCESSING = "manual_processing"
    FLAGGED = "flagged"

@dataclass
class ScoreBreakdown:
    extraction_score: float
    classification_score: float
    validation_score: float
    overall_score: float
    review_status: ReviewStatus
    flags: List[str]
    recommendations: List[str]

class ConfidenceScorer:
    """置信度評分器"""
    
    def __init__(self):
        # 權重配置
        self.weights = {
            'extraction': 0.40,
            'classification': 0.40,
            'validation': 0.20
        }
        
        # 閾值配置
        self.thresholds = {
            'auto_approve': 95,
            'quick_review': 80,
            'detailed_review': 60
        }
        
        # 必填字段
        self.required_header_fields = ['invoice_number', 'invoice_date', 'total_amount', 'vendor_name']
    
    def calculate_score(self, extraction_result: dict, 
                        classification_results: List[dict]) -> ScoreBreakdown:
        """
        計算整體置信度評分
        
        Args:
            extraction_result: 數據提取結果
            classification_results: 分類結果列表
        
        Returns:
            ScoreBreakdown
        """
        
        flags = []
        recommendations = []
        
        # 1. 計算提取評分
        extraction_score, extraction_flags = self._calculate_extraction_score(extraction_result)
        flags.extend(extraction_flags)
        
        # 2. 計算分類評分
        classification_score, classification_flags = self._calculate_classification_score(
            classification_results
        )
        flags.extend(classification_flags)
        
        # 3. 計算驗證評分
        validation_score, validation_flags = self._calculate_validation_score(
            extraction_result, classification_results
        )
        flags.extend(validation_flags)
        
        # 4. 計算總分
        overall_score = (
            extraction_score * self.weights['extraction'] +
            classification_score * self.weights['classification'] +
            validation_score * self.weights['validation']
        )
        
        # 5. 決定審核狀態
        review_status = self._determine_review_status(overall_score, flags)
        
        # 6. 生成建議
        recommendations = self._generate_recommendations(
            extraction_score, classification_score, validation_score, flags
        )
        
        return ScoreBreakdown(
            extraction_score=round(extraction_score, 1),
            classification_score=round(classification_score, 1),
            validation_score=round(validation_score, 1),
            overall_score=round(overall_score, 1),
            review_status=review_status,
            flags=flags,
            recommendations=recommendations
        )
    
    def _calculate_extraction_score(self, result: dict) -> tuple:
        """計算提取評分"""
        
        score = 0
        flags = []
        
        header = result.get('header', {})
        confidence_scores = result.get('confidence_scores', {})
        
        # 1. Header 完整性 (最高 37.5 分)
        present_required = sum(1 for f in self.required_header_fields if header.get(f))
        completeness = present_required / len(self.required_header_fields)
        header_score = completeness * 37.5
        score += header_score
        
        if completeness < 1:
            missing = [f for f in self.required_header_fields if not header.get(f)]
            flags.append(f"MISSING_FIELDS: {', '.join(missing)}")
        
        # 2. Azure OCR 置信度 (最高 37.5 分)
        if confidence_scores:
            avg_confidence = sum(confidence_scores.values()) / len(confidence_scores)
            ocr_score = avg_confidence * 37.5
            score += ocr_score
            
            if avg_confidence < 0.8:
                flags.append(f"LOW_OCR_CONFIDENCE: {avg_confidence:.1%}")
        else:
            score += 18.75  # 默認中等分數
        
        # 3. Line Items 提取 (最高 25 分)
        line_items = result.get('line_items', [])
        if line_items:
            # 假設有描述和金額的項目才算完整
            complete_items = sum(1 for item in line_items 
                               if item.get('description') and item.get('amount'))
            items_score = (complete_items / len(line_items)) * 25 if line_items else 0
            score += items_score
            
            if complete_items < len(line_items):
                flags.append(f"INCOMPLETE_LINE_ITEMS: {complete_items}/{len(line_items)}")
        else:
            flags.append("NO_LINE_ITEMS_EXTRACTED")
        
        return score, flags
    
    def _calculate_classification_score(self, results: List[dict]) -> tuple:
        """計算分類評分"""
        
        if not results:
            return 0, ["NO_CLASSIFICATION_RESULTS"]
        
        flags = []
        
        # 1. 平均置信度 (最高 62.5 分)
        confidences = [r['classification']['confidence'] for r in results 
                      if 'classification' in r]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        confidence_score = avg_confidence * 62.5
        
        # 2. 低置信度項目數
        low_conf_items = [r for r in results 
                        if r.get('classification', {}).get('confidence', 0) < 0.8]
        if low_conf_items:
            flags.append(f"LOW_CONFIDENCE_ITEMS: {len(low_conf_items)}")
        
        # 3. 方法一致性獎勵 (最高 37.5 分)
        methods = [r['classification'].get('method') for r in results 
                  if 'classification' in r]
        
        # 如果有多種方法且結果一致，給予獎勵
        method_agreement_bonus = 0
        exact_matches = sum(1 for m in methods if m == 'exact')
        if exact_matches > len(methods) * 0.5:
            method_agreement_bonus = 37.5  # 大部分是精確匹配
        elif exact_matches > 0:
            method_agreement_bonus = 25
        else:
            method_agreement_bonus = 15
        
        score = confidence_score + method_agreement_bonus
        
        return score, flags
    
    def _calculate_validation_score(self, extraction: dict, 
                                     classifications: List[dict]) -> tuple:
        """計算驗證評分"""
        
        score = 0
        flags = []
        
        header = extraction.get('header', {})
        
        # 1. 金額驗證 (最高 50 分)
        total_amount = header.get('total_amount')
        if total_amount and classifications:
            # 計算 line items 總和
            items_sum = sum(
                r['original'].get('amount', 0) 
                for r in classifications 
                if isinstance(r['original'].get('amount'), (int, float))
            )
            
            if items_sum > 0:
                difference_pct = abs(total_amount - items_sum) / total_amount * 100
                
                if difference_pct <= 1:
                    score += 50  # 完美匹配
                elif difference_pct <= 5:
                    score += 40
                elif difference_pct <= 10:
                    score += 25
                    flags.append(f"TOTAL_MISMATCH: {difference_pct:.1f}%")
                else:
                    score += 10
                    flags.append(f"TOTAL_MISMATCH_SEVERE: {difference_pct:.1f}%")
        else:
            score += 25  # 無法驗證時給予中等分數
        
        # 2. 格式驗證 (最高 50 分)
        format_score = 0
        
        # Invoice number 格式
        invoice_number = header.get('invoice_number', '')
        if invoice_number and len(invoice_number) >= 3:
            format_score += 15
        else:
            flags.append("INVALID_INVOICE_NUMBER_FORMAT")
        
        # Date 格式
        invoice_date = header.get('invoice_date')
        if invoice_date:
            format_score += 15
        else:
            flags.append("MISSING_DATE")
        
        # Currency 有效性
        currency = header.get('currency', '')
        valid_currencies = ['HKD', 'USD', 'CNY', 'EUR', 'JPY', 'GBP', 'SGD']
        if currency in valid_currencies:
            format_score += 20
        elif currency:
            format_score += 10
            flags.append(f"UNKNOWN_CURRENCY: {currency}")
        
        score += format_score
        
        return score, flags
    
    def _determine_review_status(self, overall_score: float, 
                                  flags: List[str]) -> ReviewStatus:
        """決定審核狀態"""
        
        # 檢查是否有嚴重問題需要標記
        critical_flags = [
            'MISSING_FIELDS',
            'NO_LINE_ITEMS_EXTRACTED',
            'TOTAL_MISMATCH_SEVERE'
        ]
        
        has_critical = any(
            any(cf in flag for cf in critical_flags) 
            for flag in flags
        )
        
        if has_critical:
            return ReviewStatus.FLAGGED
        
        if overall_score >= self.thresholds['auto_approve']:
            return ReviewStatus.AUTO_APPROVED
        elif overall_score >= self.thresholds['quick_review']:
            return ReviewStatus.QUICK_REVIEW
        elif overall_score >= self.thresholds['detailed_review']:
            return ReviewStatus.DETAILED_REVIEW
        else:
            return ReviewStatus.MANUAL_PROCESSING
    
    def _generate_recommendations(self, extraction_score: float,
                                    classification_score: float,
                                    validation_score: float,
                                    flags: List[str]) -> List[str]:
        """生成改進建議"""
        
        recommendations = []
        
        if extraction_score < 70:
            recommendations.append("建議檢查文件品質，可能需要重新掃描")
        
        if classification_score < 70:
            recommendations.append("多個費用項目分類置信度較低，建議人工確認分類")
        
        if validation_score < 70:
            recommendations.append("金額或格式驗證未通過，建議核對原始發票")
        
        if 'TOTAL_MISMATCH' in str(flags):
            recommendations.append("發票總額與行項目總和不符，請核實是否有遺漏項目")
        
        return recommendations
```

---

## 7. n8n 工作流設計

### 7.1 主工作流架構

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    n8n WORKFLOW ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              WORKFLOW 1: DOCUMENT INGESTION                      │    │
│  │                                                                  │    │
│  │  ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐            │    │
│  │  │ IMAP   │──▶│ Filter │──▶│ Extract│──▶│ Upload │            │    │
│  │  │ Trigger│   │ Emails │   │ Attach │   │ to API │            │    │
│  │  └────────┘   └────────┘   └────────┘   └────────┘            │    │
│  │       │                                                         │    │
│  │       ▼                                                         │    │
│  │  ┌────────┐   ┌────────┐                                       │    │
│  │  │DocuWare│──▶│ Webhook│──▶ (to Workflow 2)                    │    │
│  │  │ Watch  │   │ Trigger│                                       │    │
│  │  └────────┘   └────────┘                                       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              WORKFLOW 2: AI PROCESSING                           │    │
│  │                                                                  │    │
│  │  ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐            │    │
│  │  │ Webhook│──▶│Preproc-│──▶│ Azure  │──▶│ Parse  │            │    │
│  │  │        │   │ essing │   │Doc Intl│   │ Result │            │    │
│  │  └────────┘   └────────┘   └────────┘   └────────┘            │    │
│  │                                              │                  │    │
│  │                                              ▼                  │    │
│  │                         ┌────────┐   ┌────────┐   ┌────────┐  │    │
│  │                         │Forwardr│──▶│Cost    │──▶│Scoring │  │    │
│  │                         │ Detect │   │Classify│   │ Engine │  │    │
│  │                         └────────┘   └────────┘   └────────┘  │    │
│  │                                                       │        │    │
│  │                                                       ▼        │    │
│  │  ┌────────────────────────────────────────────────────────┐   │    │
│  │  │                   ROUTING SWITCH                        │   │    │
│  │  │  Score >= 95%  ──▶ Auto-Approve ──▶ Complete             │   │    │
│  │  │  Score 80-94%  ──▶ Quick Review Queue                    │   │    │
│  │  │  Score 60-79%  ──▶ Detailed Review Queue                 │   │    │
│  │  │  Score < 60%   ──▶ Manual Processing Queue               │   │    │
│  │  │  Has Flags     ──▶ Flagged Queue                         │   │    │
│  │  └────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                              │                                           │
│                              ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              WORKFLOW 3: NOTIFICATIONS                           │    │
│  │                                                                  │    │
│  │  • Low score alert → Email/Teams to SCM team                    │    │
│  │  • Daily summary → Processed count, review queue size           │    │
│  │  • Error alert → Failed processing notification                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              WORKFLOW 4: SCHEDULED REPORTS                       │    │
│  │                                                                  │    │
│  │  • Weekly SCM Excel export                                       │    │
│  │  • Monthly cost analysis report                                  │    │
│  │  • Forwarder performance comparison                              │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 7.2 n8n Workflow JSON 範例

```json
{
  "name": "Freight Invoice AI Processing",
  "nodes": [
    {
      "name": "Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "position": [250, 300],
      "webhookId": "invoice-process",
      "parameters": {
        "httpMethod": "POST",
        "path": "process-invoice",
        "responseMode": "onReceived",
        "responseData": "allEntries"
      }
    },
    {
      "name": "Get File from Storage",
      "type": "n8n-nodes-base.httpRequest",
      "position": [450, 300],
      "parameters": {
        "method": "GET",
        "url": "={{ $json.file_url }}",
        "responseFormat": "file"
      }
    },
    {
      "name": "Document Preprocessing",
      "type": "n8n-nodes-base.httpRequest",
      "position": [650, 300],
      "parameters": {
        "method": "POST",
        "url": "http://api:8000/api/preprocess",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "file",
              "value": "={{ $binary.data }}"
            }
          ]
        }
      }
    },
    {
      "name": "Azure Document Intelligence",
      "type": "n8n-nodes-base.httpRequest",
      "position": [850, 300],
      "parameters": {
        "method": "POST",
        "url": "https://{{$env.AZURE_DOC_INTEL_ENDPOINT}}/documentintelligence/documentModels/prebuilt-invoice:analyze?api-version=2024-11-30",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "azureAiApi",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/pdf"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "",
              "value": "={{ $binary.data }}"
            }
          ]
        }
      }
    },
    {
      "name": "Poll for Result",
      "type": "n8n-nodes-base.httpRequest",
      "position": [1050, 300],
      "parameters": {
        "method": "GET",
        "url": "={{ $json.headers['operation-location'] }}",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "azureAiApi"
      }
    },
    {
      "name": "Wait for Completion",
      "type": "n8n-nodes-base.wait",
      "position": [1050, 450],
      "parameters": {
        "amount": 2,
        "unit": "seconds"
      }
    },
    {
      "name": "Check Status",
      "type": "n8n-nodes-base.if",
      "position": [1250, 300],
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{ $json.status }}",
              "operation": "equals",
              "value2": "succeeded"
            }
          ]
        }
      }
    },
    {
      "name": "Parse Extraction Result",
      "type": "n8n-nodes-base.code",
      "position": [1450, 200],
      "parameters": {
        "jsCode": "// Parse Azure Document Intelligence result\nconst result = $input.all()[0].json;\nconst documents = result.analyzeResult?.documents || [];\nconst doc = documents[0] || {};\nconst fields = doc.fields || {};\n\n// Extract header fields\nconst header = {\n  vendor_name: fields.VendorName?.content || '',\n  invoice_number: fields.InvoiceId?.content || '',\n  invoice_date: fields.InvoiceDate?.content || '',\n  total_amount: fields.InvoiceTotal?.value?.amount || 0,\n  currency: fields.InvoiceTotal?.value?.currencyCode || 'HKD'\n};\n\n// Extract line items\nconst lineItems = (fields.Items?.value || []).map(item => ({\n  description: item.value?.Description?.content || '',\n  amount: item.value?.Amount?.value?.amount || 0,\n  confidence: item.value?.Description?.confidence || 0\n}));\n\n// Calculate overall confidence\nconst confidences = Object.values(fields)\n  .filter(f => f && f.confidence)\n  .map(f => f.confidence);\nconst overallConfidence = confidences.length \n  ? confidences.reduce((a, b) => a + b) / confidences.length \n  : 0;\n\nreturn {\n  json: {\n    header,\n    line_items: lineItems,\n    overall_confidence: overallConfidence,\n    raw_text: result.analyzeResult?.content || ''\n  }\n};"
      }
    },
    {
      "name": "Identify Forwarder",
      "type": "n8n-nodes-base.httpRequest",
      "position": [1650, 200],
      "parameters": {
        "method": "POST",
        "url": "http://api:8000/api/identify-forwarder",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "invoice_number",
              "value": "={{ $json.header.invoice_number }}"
            },
            {
              "name": "vendor_name",
              "value": "={{ $json.header.vendor_name }}"
            },
            {
              "name": "raw_text",
              "value": "={{ $json.raw_text.substring(0, 2000) }}"
            }
          ]
        }
      }
    },
    {
      "name": "Classify Costs",
      "type": "n8n-nodes-base.httpRequest",
      "position": [1850, 200],
      "parameters": {
        "method": "POST",
        "url": "http://api:8000/api/classify-costs",
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "line_items",
              "value": "={{ JSON.stringify($json.line_items) }}"
            },
            {
              "name": "forwarder_code",
              "value": "={{ $json.forwarder.code }}"
            },
            {
              "name": "transport_mode",
              "value": "sea"
            }
          ]
        }
      }
    },
    {
      "name": "Calculate Score",
      "type": "n8n-nodes-base.httpRequest",
      "position": [2050, 200],
      "parameters": {
        "method": "POST",
        "url": "http://api:8000/api/calculate-score",
        "sendBody": true,
        "contentType": "json",
        "body": "={{ JSON.stringify($json) }}"
      }
    },
    {
      "name": "Routing Switch",
      "type": "n8n-nodes-base.switch",
      "position": [2250, 200],
      "parameters": {
        "dataType": "string",
        "value1": "={{ $json.score.review_status }}",
        "rules": {
          "rules": [
            {
              "value2": "auto_approved",
              "output": 0
            },
            {
              "value2": "quick_review",
              "output": 1
            },
            {
              "value2": "detailed_review",
              "output": 2
            },
            {
              "value2": "manual_processing",
              "output": 3
            }
          ]
        }
      }
    },
    {
      "name": "Save to Database (Auto-Approved)",
      "type": "n8n-nodes-base.postgres",
      "position": [2500, 100],
      "parameters": {
        "operation": "insert",
        "table": "invoices",
        "columns": "status, forwarder_id, invoice_number, invoice_date, total_amount, currency, extraction_confidence, classification_confidence, overall_score, processed_at",
        "values": "='completed', '{{ $json.forwarder.id }}', '{{ $json.header.invoice_number }}', '{{ $json.header.invoice_date }}', {{ $json.header.total_amount }}, '{{ $json.header.currency }}', {{ $json.extraction_confidence }}, {{ $json.classification_confidence }}, {{ $json.score.overall_score }}, NOW()"
      }
    },
    {
      "name": "Add to Quick Review Queue",
      "type": "n8n-nodes-base.postgres",
      "position": [2500, 250],
      "parameters": {
        "operation": "insert",
        "table": "review_queue",
        "columns": "invoice_id, queue_type, priority, created_at",
        "values": "={{ $json.invoice_id }}, 'quick_review', 2, NOW()"
      }
    },
    {
      "name": "Add to Detailed Review Queue",
      "type": "n8n-nodes-base.postgres",
      "position": [2500, 400],
      "parameters": {
        "operation": "insert",
        "table": "review_queue",
        "columns": "invoice_id, queue_type, priority, created_at",
        "values": "={{ $json.invoice_id }}, 'detailed_review', 3, NOW()"
      }
    },
    {
      "name": "Notify SCM Team",
      "type": "n8n-nodes-base.microsoftTeams",
      "position": [2500, 550],
      "parameters": {
        "operation": "sendMessage",
        "channel": "SCM-Invoices",
        "message": "🚨 發票需要人工處理\n\n發票號碼: {{ $json.header.invoice_number }}\n貨代: {{ $json.forwarder.name }}\n置信度: {{ $json.score.overall_score }}%\n問題: {{ $json.score.flags.join(', ') }}"
      }
    }
  ],
  "connections": {
    "Webhook Trigger": {
      "main": [
        [{"node": "Get File from Storage", "type": "main", "index": 0}]
      ]
    },
    "Get File from Storage": {
      "main": [
        [{"node": "Document Preprocessing", "type": "main", "index": 0}]
      ]
    },
    "Document Preprocessing": {
      "main": [
        [{"node": "Azure Document Intelligence", "type": "main", "index": 0}]
      ]
    },
    "Azure Document Intelligence": {
      "main": [
        [{"node": "Poll for Result", "type": "main", "index": 0}]
      ]
    },
    "Poll for Result": {
      "main": [
        [{"node": "Check Status", "type": "main", "index": 0}]
      ]
    },
    "Check Status": {
      "main": [
        [{"node": "Parse Extraction Result", "type": "main", "index": 0}],
        [{"node": "Wait for Completion", "type": "main", "index": 0}]
      ]
    },
    "Wait for Completion": {
      "main": [
        [{"node": "Poll for Result", "type": "main", "index": 0}]
      ]
    },
    "Parse Extraction Result": {
      "main": [
        [{"node": "Identify Forwarder", "type": "main", "index": 0}]
      ]
    },
    "Identify Forwarder": {
      "main": [
        [{"node": "Classify Costs", "type": "main", "index": 0}]
      ]
    },
    "Classify Costs": {
      "main": [
        [{"node": "Calculate Score", "type": "main", "index": 0}]
      ]
    },
    "Calculate Score": {
      "main": [
        [{"node": "Routing Switch", "type": "main", "index": 0}]
      ]
    },
    "Routing Switch": {
      "main": [
        [{"node": "Save to Database (Auto-Approved)", "type": "main", "index": 0}],
        [{"node": "Add to Quick Review Queue", "type": "main", "index": 0}],
        [{"node": "Add to Detailed Review Queue", "type": "main", "index": 0}],
        [{"node": "Notify SCM Team", "type": "main", "index": 0}]
      ]
    }
  }
}
```

---

## 8. 數據庫完整設計

### 8.1 ER 圖

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATABASE SCHEMA                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐       ┌─────────────────┐                          │
│  │   forwarders    │       │   scm_categories│                          │
│  ├─────────────────┤       ├─────────────────┤                          │
│  │ id              │       │ id              │                          │
│  │ code (unique)   │       │ code (unique)   │                          │
│  │ name            │       │ name            │                          │
│  │ email_domains[] │       │ group           │                          │
│  │ invoice_patterns│       │ description     │                          │
│  │ terminology_id  │───┐   │ keywords[]      │                          │
│  └─────────────────┘   │   │ patterns[]      │                          │
│           │            │   └─────────────────┘                          │
│           │            │            │                                    │
│           │            │            │                                    │
│           ▼            │            ▼                                    │
│  ┌─────────────────┐   │   ┌─────────────────┐                          │
│  │    invoices     │   │   │classification_  │                          │
│  ├─────────────────┤   │   │    rules        │                          │
│  │ id              │   │   ├─────────────────┤                          │
│  │ file_name       │   │   │ id              │                          │
│  │ file_path       │   │   │ rule_type       │                          │
│  │ forwarder_id    │───┘   │ match_pattern   │                          │
│  │ invoice_number  │       │ scm_category_id │───┐                      │
│  │ invoice_date    │       │ forwarder_id    │   │                      │
│  │ total_amount    │       │ priority        │   │                      │
│  │ currency        │       │ match_count     │   │                      │
│  │ status          │       │ is_active       │   │                      │
│  │ extraction_conf │       └─────────────────┘   │                      │
│  │ overall_score   │                             │                      │
│  │ review_status   │                             │                      │
│  │ azure_result    │   ┌─────────────────┐       │                      │
│  │ reviewed_by     │   │ learned_mappings│       │                      │
│  │ reviewed_at     │   ├─────────────────┤       │                      │
│  └─────────────────┘   │ id              │       │                      │
│           │            │ norm_description│       │                      │
│           │            │ scm_category_id │───────┘                      │
│           ▼            │ forwarder_id    │                              │
│  ┌─────────────────┐   │ confidence      │                              │
│  │invoice_line_    │   │ match_count     │                              │
│  │    items        │   │ source          │                              │
│  ├─────────────────┤   └─────────────────┘                              │
│  │ id              │                                                     │
│  │ invoice_id      │   ┌─────────────────┐                              │
│  │ original_desc   │   │  review_queue   │                              │
│  │ original_amount │   ├─────────────────┤                              │
│  │ scm_category_id │   │ id              │                              │
│  │ classification_ │   │ invoice_id      │                              │
│  │   confidence    │   │ queue_type      │                              │
│  │ classification_ │   │ priority        │                              │
│  │   method        │   │ assigned_to     │                              │
│  │ is_reviewed     │   │ status          │                              │
│  │ manual_override │   │ created_at      │                              │
│  └─────────────────┘   └─────────────────┘                              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 完整 SQL Schema

```sql
-- =====================================================
-- FREIGHT INVOICE AI PLATFORM - DATABASE SCHEMA
-- =====================================================

-- 1. Forwarders 貨代主表
CREATE TABLE forwarders (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    short_name VARCHAR(50),
    
    -- Identification
    email_domains TEXT[],
    invoice_number_patterns TEXT[],
    bank_accounts TEXT[],
    
    -- Settings
    invoice_format_type VARCHAR(50) DEFAULT 'structured',
    default_currency VARCHAR(3) DEFAULT 'HKD',
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. SCM Categories 分類主表
CREATE TABLE scm_categories (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    name_zh VARCHAR(100),
    
    -- Grouping
    category_group VARCHAR(50),
    description TEXT,
    
    -- Matching
    keywords TEXT[],
    patterns TEXT[],
    exclude_patterns TEXT[],
    
    -- Settings
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Classification Rules 分類規則表
CREATE TABLE classification_rules (
    id SERIAL PRIMARY KEY,
    
    -- Rule definition
    rule_type VARCHAR(20) NOT NULL,  -- 'exact', 'contains', 'regex', 'fuzzy'
    match_pattern VARCHAR(500) NOT NULL,
    case_sensitive BOOLEAN DEFAULT false,
    
    -- Mapping
    scm_category_id INT REFERENCES scm_categories(id),
    forwarder_id INT REFERENCES forwarders(id),  -- NULL = all forwarders
    
    -- Priority & Stats
    priority INT DEFAULT 100,
    match_count INT DEFAULT 0,
    last_matched_at TIMESTAMP,
    
    -- Conditions
    transport_mode VARCHAR(10),  -- 'sea', 'air', 'land', NULL = all
    additional_conditions JSONB,
    
    -- Metadata
    source VARCHAR(50) DEFAULT 'manual',  -- 'manual', 'learned', 'imported'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Learned Mappings 學習映射表
CREATE TABLE learned_mappings (
    id SERIAL PRIMARY KEY,
    
    -- Matching
    normalized_description VARCHAR(500) NOT NULL,
    original_description VARCHAR(1000),
    
    -- Classification
    scm_category_id INT REFERENCES scm_categories(id),
    forwarder_id INT REFERENCES forwarders(id),
    
    -- Confidence
    confidence DECIMAL(3,2) DEFAULT 0.80,
    match_count INT DEFAULT 1,
    
    -- Source
    source VARCHAR(50) DEFAULT 'human_correction',
    
    -- Metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(normalized_description, forwarder_id)
);

-- 5. Invoices 發票主表
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    
    -- File Info
    file_name VARCHAR(500) NOT NULL,
    file_path VARCHAR(1000),
    file_size BIGINT,
    file_type VARCHAR(50),
    file_hash VARCHAR(64),  -- SHA256 for duplicate detection
    
    -- Source
    source_type VARCHAR(20) DEFAULT 'manual',  -- 'email', 'manual', 'api', 'docuware'
    source_email VARCHAR(200),
    source_reference VARCHAR(200),
    received_at TIMESTAMP,
    
    -- Forwarder
    forwarder_id INT REFERENCES forwarders(id),
    forwarder_confidence DECIMAL(3,2),
    forwarder_detection_method VARCHAR(50),
    
    -- Extracted Header
    invoice_number VARCHAR(100),
    invoice_date DATE,
    due_date DATE,
    po_number VARCHAR(100),
    
    -- Amounts
    total_amount DECIMAL(15,2),
    subtotal DECIMAL(15,2),
    tax_amount DECIMAL(15,2),
    currency VARCHAR(3),
    
    -- Shipping
    transport_mode VARCHAR(10),  -- 'sea', 'air', 'land'
    origin VARCHAR(100),
    destination VARCHAR(100),
    shipment_ref VARCHAR(100),
    
    -- Processing Status
    status VARCHAR(20) DEFAULT 'pending',
    -- pending → processing → extracted → classified → review → completed/rejected
    
    -- Confidence Scores
    extraction_confidence DECIMAL(3,2),
    classification_confidence DECIMAL(3,2),
    validation_score DECIMAL(3,2),
    overall_score DECIMAL(3,2),
    
    -- Review Info
    review_status VARCHAR(30),
    -- 'auto_approved', 'quick_review', 'detailed_review', 'manual_processing', 'flagged'
    review_flags TEXT[],
    reviewed_by INT,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    
    -- Raw Data
    azure_result JSONB,
    llm_enhancements JSONB,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- 6. Invoice Line Items 發票行項目表
CREATE TABLE invoice_line_items (
    id SERIAL PRIMARY KEY,
    invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    -- Original Data
    original_description VARCHAR(1000),
    original_amount DECIMAL(15,2),
    original_currency VARCHAR(3),
    quantity DECIMAL(10,2),
    unit_price DECIMAL(15,2),
    
    -- Classification
    scm_category_id INT REFERENCES scm_categories(id),
    scm_category_name VARCHAR(100),
    
    -- Confidence
    extraction_confidence DECIMAL(3,2),
    classification_confidence DECIMAL(3,2),
    classification_method VARCHAR(20),  -- 'exact', 'fuzzy', 'rule', 'llm', 'manual'
    
    -- Alternative classifications (for review UI)
    alternative_categories JSONB,
    
    -- Review
    is_reviewed BOOLEAN DEFAULT false,
    manual_override BOOLEAN DEFAULT false,
    original_category_id INT,  -- Before manual override
    
    -- Position
    line_order INT,
    page_number INT,
    bounding_box JSONB,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 7. Review Queue 審核隊列表
CREATE TABLE review_queue (
    id SERIAL PRIMARY KEY,
    invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    
    -- Queue Info
    queue_type VARCHAR(30) NOT NULL,
    -- 'quick_review', 'detailed_review', 'manual_processing', 'flagged'
    priority INT DEFAULT 5,  -- 1=highest, 10=lowest
    
    -- Assignment
    assigned_to INT,
    assigned_at TIMESTAMP,
    
    -- Status
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'in_progress', 'completed'
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- 8. Audit Logs 審計日誌表
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    
    -- Who
    user_id INT,
    user_email VARCHAR(200),
    
    -- What
    action VARCHAR(50) NOT NULL,  -- 'create', 'update', 'delete', 'approve', 'reject', 'classify'
    entity_type VARCHAR(50) NOT NULL,  -- 'invoice', 'line_item', 'rule', etc.
    entity_id INT,
    
    -- Details
    old_values JSONB,
    new_values JSONB,
    additional_info JSONB,
    
    -- When/Where
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 9. Processing Metrics 處理指標表
CREATE TABLE processing_metrics (
    id SERIAL PRIMARY KEY,
    
    -- Time period
    date DATE NOT NULL,
    hour INT,  -- 0-23, NULL for daily metrics
    
    -- Counts
    invoices_received INT DEFAULT 0,
    invoices_auto_approved INT DEFAULT 0,
    invoices_reviewed INT DEFAULT 0,
    invoices_rejected INT DEFAULT 0,
    
    -- Performance
    avg_extraction_confidence DECIMAL(5,2),
    avg_classification_confidence DECIMAL(5,2),
    avg_processing_time_seconds INT,
    
    -- By Category
    metrics_by_forwarder JSONB,
    metrics_by_category JSONB,
    
    UNIQUE(date, hour)
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_forwarder ON invoices(forwarder_id);
CREATE INDEX idx_invoices_date ON invoices(invoice_date);
CREATE INDEX idx_invoices_review_status ON invoices(review_status);
CREATE INDEX idx_invoices_created ON invoices(created_at);

CREATE INDEX idx_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX idx_line_items_category ON invoice_line_items(scm_category_id);

CREATE INDEX idx_rules_category ON classification_rules(scm_category_id);
CREATE INDEX idx_rules_forwarder ON classification_rules(forwarder_id);
CREATE INDEX idx_rules_active ON classification_rules(is_active) WHERE is_active = true;

CREATE INDEX idx_learned_desc ON learned_mappings(normalized_description);
CREATE INDEX idx_learned_forwarder ON learned_mappings(forwarder_id);

CREATE INDEX idx_review_queue_status ON review_queue(status, queue_type);
CREATE INDEX idx_review_queue_assigned ON review_queue(assigned_to);

CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_time ON audit_logs(created_at);

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert SCM Categories
INSERT INTO scm_categories (code, name, category_group, keywords, patterns) VALUES
('FRT', 'Freight', '運費', ARRAY['OCEAN FREIGHT', 'SEA FREIGHT', 'AIR FREIGHT', 'EXPRESS BILL OF LADING'], ARRAY['freight', 'o/f', 'a/f']),
('BAF', 'BAF', '運費附加', ARRAY['BAF', 'BUNKER ADJUSTMENT'], ARRAY['baf', 'bunker']),
('DLV', 'Delivery', '陸運', ARRAY['DRAYAGE', 'TRUCKING', 'HAULAGE', 'D/O FEE', 'DELIVERY ORDER FEE'], ARRAY['drayage', 'trucking', 'delivery']),
('GAT', 'Gate charge', '陸運', ARRAY['GATE CHARGE', 'GATE FEE'], ARRAY['gate']),
('THC', 'THC', '碼頭', ARRAY['THC', 'TERMINAL HANDLING CHARGE'], ARRAY['thc', 'terminal handling']),
('DEM', 'Detention/Demurrage', '碼頭', ARRAY['DETENTION', 'DEMURRAGE'], ARRAY['detention', 'demurrage']),
('DVN', 'Devanning cost', '倉儲', ARRAY['VANNING', 'DEVANNING', 'UNSTUFFING'], ARRAY['vanning', 'devanning']),
('CLR', 'Clearance', '清關', ARRAY['CLEARANCE', 'CUSTOMS CLEARANCE'], ARRAY['clearance']),
('DOC', 'Docs Fee', '文件', ARRAY['DOCUMENT FEE', 'DOCUMENTATION'], ARRAY['doc fee', 'documentation']),
('HDL', 'Handling', '處理', ARRAY['HANDLING CHARGE', 'HANDLING FEE'], ARRAY['handling']),
('CLN', 'Cleaning at origin', '起運地', ARRAY['CLEANING', 'CONTAINER CLEANING'], ARRAY['cleaning', 'clean']),
('OTL', 'Others Local Charge', '其他', ARRAY['OTHER CHARGES', 'MISCELLANEOUS'], ARRAY['other', 'misc']);

-- Insert Forwarders
INSERT INTO forwarders (code, name, short_name, email_domains, invoice_number_patterns) VALUES
('CEVA', 'CEVA Logistics', 'CEVA', ARRAY['ceva.com', 'cevalogistics.com'], ARRAY['^[A-Z]{2}\d{8}$']),
('NIPPON', 'Nippon Express', 'Nippon', ARRAY['nippon-express.com', 'nittsu.com'], ARRAY['^NE\d+']),
('TOLL', 'Toll Global Forwarding', 'TOLL', ARRAY['tollgroup.com'], ARRAY['^TL[A-Z]{2}\d{8}$']),
('WK', 'Wang Kay Logistics', 'WK', ARRAY['wangkay.com'], ARRAY['^W-[A-Z]{2}-\d{4}-\d{3}$']),
('RIL', 'Ricoh International Logistics', 'RIL', ARRAY['ril.com'], ARRAY['^\d{7}$']),
('MAINFREIGHT', 'Mainfreight', 'Mainfreight', ARRAY['mainfreight.com'], ARRAY['^MF\d+']);
```

---

## 9. 開發階段與時間表

### 9.1 整體路線圖

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT ROADMAP                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PHASE 0: PREPARATION (2 weeks)                                         │
│  ═══════════════════════════════                                        │
│  Week 1:                                                                │
│  • Finalize requirements with SCM team                                  │
│  • Setup Azure resources (Doc Intelligence, Blob Storage)               │
│  • Setup development environment                                        │
│                                                                          │
│  Week 2:                                                                │
│  • Setup n8n instance                                                   │
│  • Create database schema                                               │
│  • Document API specifications                                          │
│                                                                          │
│  Deliverables: Environment ready, API specs, database deployed          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  PHASE 1: POC (3 weeks)                                                 │
│  ══════════════════════                                                 │
│  Week 3:                                                                │
│  • Implement document preprocessing                                      │
│  • Azure Document Intelligence integration                              │
│  • Basic extraction pipeline                                            │
│                                                                          │
│  Week 4:                                                                │
│  • Forwarder identification module                                      │
│  • Cost classification engine (Layer 1 & 2)                             │
│  • Basic n8n workflow                                                   │
│                                                                          │
│  Week 5:                                                                │
│  • LLM integration (Layer 3)                                            │
│  • Scoring engine                                                       │
│  • Test with 6 sample invoices from different forwarders                │
│                                                                          │
│  Deliverables: Working POC, accuracy report, go/no-go decision          │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  PHASE 2: MVP (4 weeks)                                                 │
│  ═════════════════════                                                  │
│  Week 6-7:                                                              │
│  • Backend API development                                              │
│  • Complete n8n workflow with all routing logic                         │
│  • Database integration                                                 │
│                                                                          │
│  Week 8-9:                                                              │
│  • Review Portal UI (basic version)                                     │
│    - Invoice list view                                                  │
│    - Side-by-side review interface                                      │
│    - Quick approve/reject actions                                       │
│  • DocuWare integration                                                 │
│  • Basic Excel export                                                   │
│                                                                          │
│  Deliverables: Functional MVP for pilot testing                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  PHASE 3: PILOT (4 weeks)                                               │
│  ════════════════════════                                               │
│  Week 10-11:                                                            │
│  • Deploy to single city/station                                        │
│  • User training                                                        │
│  • Collect real invoices and process                                    │
│                                                                          │
│  Week 12-13:                                                            │
│  • Gather feedback and iterate                                          │
│  • Fix bugs and improve accuracy                                        │
│  • Optimize classification rules based on corrections                   │
│                                                                          │
│  Deliverables: Pilot report, accuracy metrics, improvement plan         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  PHASE 4: ENHANCEMENT (3 weeks)                                         │
│  ══════════════════════════════                                         │
│  Week 14-15:                                                            │
│  • Enhanced Review UI (with highlighting, batch operations)             │
│  • Dashboard and analytics                                              │
│  • Email auto-ingestion                                                 │
│                                                                          │
│  Week 16:                                                               │
│  • Power BI integration                                                 │
│  • Advanced reporting                                                   │
│  • Performance optimization                                             │
│                                                                          │
│  Deliverables: Production-ready system                                  │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  PHASE 5: ROLLOUT (Ongoing)                                             │
│  ══════════════════════════                                             │
│  • Onboard remaining cities                                             │
│  • Continuous improvement                                               │
│  • Add new forwarders                                                   │
│  • Monitor and optimize                                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 9.2 詳細任務分解

| Phase | Week | Task | Owner | Status |
|-------|------|------|-------|--------|
| **0** | 1 | Setup Azure Doc Intelligence | DevOps | ⬜ |
| **0** | 1 | Setup Azure Blob Storage | DevOps | ⬜ |
| **0** | 1 | Collect forwarder terminology from all cities | SCM | ⬜ |
| **0** | 2 | Deploy n8n instance | DevOps | ⬜ |
| **0** | 2 | Create database schema | Backend | ⬜ |
| **0** | 2 | API specification document | Backend | ⬜ |
| **1** | 3 | Document preprocessor module | Backend | ⬜ |
| **1** | 3 | Azure Doc Intelligence integration | Backend | ⬜ |
| **1** | 4 | Forwarder identifier module | Backend | ⬜ |
| **1** | 4 | Cost classifier (Rule-based) | Backend | ⬜ |
| **1** | 4 | Basic n8n workflow | Backend | ⬜ |
| **1** | 5 | LLM classification layer | Backend | ⬜ |
| **1** | 5 | Scoring engine | Backend | ⬜ |
| **1** | 5 | POC testing & accuracy report | All | ⬜ |
| **2** | 6-7 | Backend API development | Backend | ⬜ |
| **2** | 6-7 | Complete n8n workflows | Backend | ⬜ |
| **2** | 8-9 | Review Portal UI | Frontend | ⬜ |
| **2** | 8-9 | DocuWare integration | Backend | ⬜ |
| **2** | 9 | Excel export | Backend | ⬜ |
| **3** | 10-11 | Pilot deployment | All | ⬜ |
| **3** | 10-11 | User training | PM | ⬜ |
| **3** | 12-13 | Feedback iteration | All | ⬜ |
| **4** | 14-15 | Enhanced UI | Frontend | ⬜ |
| **4** | 14-15 | Dashboard & Analytics | Frontend | ⬜ |
| **4** | 16 | Power BI integration | BI | ⬜ |

---

## 10. 成本估算

### 10.1 開發成本

| 項目 | 估算 (USD) |
|------|-----------|
| 內部開發 (假設 2 開發者 × 4 個月) | $40,000 - $60,000 |
| **或** 外包開發 (MVP + Enhancement) | $60,000 - $100,000 |
| 低代碼方案 (Retool + 後端 API) | $30,000 - $50,000 |

### 10.2 每月運營成本 (1,000 發票/月)

| 服務 | 估算 (USD/月) |
|------|--------------|
| Azure Document Intelligence (2,000 頁 × $10/1K) | $20 |
| Azure OpenAI (LLM 分類，~500 次) | $10 |
| Azure Blob Storage | $5 |
| Web App Hosting | $50 - $100 |
| PostgreSQL Database | $30 - $50 |
| n8n (自託管) | $0 |
| **月度總計** | **$115 - $185** |
| **年度總計** | **$1,380 - $2,220** |

### 10.3 ROI 分析

假設當前狀況：
- 5 城市 × 0.5 FTE × $2,000/月 = $5,000/月
- 年人工成本：$60,000

新方案（第一年）：
- 開發成本：$60,000 (一次性)
- 運營成本：$2,000/年
- 總成本：$62,000

節省（假設 90% 自動化）：
- 節省人工：$60,000 × 90% = $54,000/年

**回本期：約 14 個月**

---

## 11. 關鍵成功因素

1. **準確的分類規則庫**
   - 收集所有城市的 forwarder 術語
   - 建立完善的映射表
   - 持續從人工校正中學習

2. **合適的置信度閾值**
   - 初期可設較低閾值，確保準確性
   - 隨著系統學習，逐步提高自動審批比例

3. **用戶友好的審核界面**
   - 側邊對比視圖
   - 一鍵審批功能
   - 清晰的問題標記

4. **持續優化機制**
   - 記錄所有人工修正
   - 定期分析錯誤模式
   - 更新分類規則

5. **良好的異常處理**
   - 優雅處理新格式發票
   - 及時通知無法處理的文件
   - 保留原始數據供追溯

---

## 12. 下一步行動

1. **立即行動**
   - [ ] 確認 POC 測試發票樣本（建議每個 forwarder 至少 5 張）
   - [ ] 申請 Azure Document Intelligence 資源
   - [ ] 確認 n8n 部署環境

2. **第一週**
   - [ ] 完成 80+ Header 的完整定義和中英文對照
   - [ ] 收集各城市 forwarder 使用的術語差異
   - [ ] 建立初始分類規則表

3. **POC 期間**
   - [ ] 測試 Azure Doc Intelligence 對不同格式發票的提取效果
   - [ ] 驗證三層分類引擎的準確度
   - [ ] 確定置信度閾值的合適範圍

---

*文檔版本: 1.0*
*最後更新: 2024-12*
