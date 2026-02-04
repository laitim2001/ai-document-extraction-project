# Story 21.8: 管理頁面 - 計算器與 Import

**Status:** pending

---

## Story

**As a** 系統管理員,
**I want** 使用即時計算器和批次導入功能,
**So that** 可以快速驗證匯率並批次建立記錄。

---

## 背景說明

### 問題陳述

需要在管理頁面提供：
- 即時匯率計算器（快速驗證轉換結果）
- 批次導入對話框（上傳 JSON 檔案）

---

## Acceptance Criteria

### AC1: 即時計算器

**Given** 列表頁面的計算器區塊
**When** 輸入金額和選擇貨幣對
**Then**:
  - 即時顯示轉換結果
  - 顯示使用的匯率和轉換路徑
  - 如果找不到匯率，顯示提示

### AC2: 導入對話框

**Given** 點擊「導入」按鈕
**When** 開啟對話框
**Then**:
  - 支援上傳 JSON 檔案
  - 支援貼上 JSON 文字
  - 顯示預覽和驗證結果

### AC3: 導入選項

**Given** 導入對話框
**When** 選擇選項
**Then** 支援：
  - 覆蓋現有記錄
  - 跳過無效記錄
  - 建立反向匯率

### AC4: 導入結果

**Given** 執行導入
**When** 導入完成
**Then**:
  - 顯示成功/失敗統計
  - 列出錯誤詳情
  - 刷新列表

### AC5: 導出功能

**Given** 列表頁面
**When** 點擊「導出」按鈕
**Then** 下載 JSON 檔案，包含當前篩選條件的資料

---

## Tasks / Subtasks

- [ ] **Task 1: 即時計算器** (AC: #1)
  - [ ] 1.1 建立 ExchangeRateCalculator 組件
  - [ ] 1.2 整合 Convert API
  - [ ] 1.3 顯示轉換路徑

- [ ] **Task 2: 導入對話框** (AC: #2, #3)
  - [ ] 2.1 建立 ExchangeRateImportDialog 組件
  - [ ] 2.2 實現檔案上傳
  - [ ] 2.3 實現 JSON 貼上
  - [ ] 2.4 實現預覽和驗證
  - [ ] 2.5 整合導入選項

- [ ] **Task 3: 導入結果** (AC: #4)
  - [ ] 3.1 顯示導入統計
  - [ ] 3.2 顯示錯誤詳情
  - [ ] 3.3 刷新列表

- [ ] **Task 4: 導出功能** (AC: #5)
  - [ ] 4.1 整合 Export API
  - [ ] 4.2 實現檔案下載

---

## Dev Notes

### 依賴項

- **Story 21-5**: Import/Export API
- **Story 21-7**: 管理頁面 - 表單

### 新增文件

```
src/components/features/exchange-rate/
├── ExchangeRateCalculator.tsx       # 新增
└── ExchangeRateImportDialog.tsx     # 新增
```

### ExchangeRateCalculator 組件設計

```typescript
interface CalculatorResult {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  convertedAmount: number;
  rate: number;
  path: string;
}

export function ExchangeRateCalculator() {
  const [fromCurrency, setFromCurrency] = useState('');
  const [toCurrency, setToCurrency] = useState('');
  const [amount, setAmount] = useState('');
  const [result, setResult] = useState<CalculatorResult | null>(null);

  const { mutate: convert, isPending } = useConvertCurrency();

  const handleCalculate = () => {
    if (!fromCurrency || !toCurrency || !amount) return;

    convert({
      fromCurrency,
      toCurrency,
      amount: Number(amount),
    }, {
      onSuccess: (data) => setResult(data.data),
      onError: (error) => {
        // 顯示錯誤訊息
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('calculator.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <CurrencySelect value={fromCurrency} onChange={setFromCurrency} />
          <ArrowRight className="h-6 w-6" />
          <CurrencySelect value={toCurrency} onChange={setToCurrency} />
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Button onClick={handleCalculate} disabled={isPending}>
            {t('calculator.calculate')}
          </Button>
        </div>

        {result && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-2xl font-bold">
              {result.amount} {result.fromCurrency} = {result.convertedAmount.toFixed(2)} {result.toCurrency}
            </p>
            <p className="text-sm text-muted-foreground">
              {t('calculator.rate')}: {result.rate} ({result.path})
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### ExchangeRateImportDialog 組件設計

```typescript
interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ index: number; error: string }>;
}

export function ExchangeRateImportDialog() {
  const [open, setOpen] = useState(false);
  const [jsonData, setJsonData] = useState('');
  const [options, setOptions] = useState({
    overwriteExisting: false,
    skipInvalid: true,
  });
  const [previewData, setPreviewData] = useState<unknown[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);

  const { mutate: importRates, isPending } = useImportExchangeRates();

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setJsonData(text);
      parseAndPreview(text);
    };
    reader.readAsText(file);
  };

  const parseAndPreview = (text: string) => {
    try {
      const data = JSON.parse(text);
      setPreviewData(data.items || data);
    } catch {
      // 顯示 JSON 解析錯誤
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4 mr-2" />
          {t('actions.import')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        {/* 檔案上傳區域 */}
        {/* JSON 文字輸入區域 */}
        {/* 選項 */}
        {/* 預覽表格 */}
        {/* 導入結果 */}
      </DialogContent>
    </Dialog>
  );
}
```

### i18n 擴展

```json
// 新增到 exchangeRate.json
{
  "calculator": {
    "title": "匯率計算器",
    "amount": "金額",
    "calculate": "計算",
    "rate": "使用匯率",
    "noRate": "找不到匯率記錄"
  },
  "import": {
    "title": "導入匯率",
    "uploadFile": "上傳 JSON 檔案",
    "pasteJson": "或貼上 JSON",
    "preview": "預覽",
    "options": "導入選項",
    "overwriteExisting": "覆蓋現有記錄",
    "skipInvalid": "跳過無效記錄",
    "submit": "開始導入",
    "result": {
      "title": "導入結果",
      "imported": "新增",
      "updated": "更新",
      "skipped": "跳過",
      "errors": "錯誤"
    }
  },
  "export": {
    "title": "導出匯率",
    "downloading": "正在下載..."
  }
}
```

---

## Implementation Notes

（開發完成後填寫）

---

## Related Files

- `src/components/features/exchange-rate/ExchangeRateCalculator.tsx` - 新增
- `src/components/features/exchange-rate/ExchangeRateImportDialog.tsx` - 新增
- `messages/{locale}/exchangeRate.json` - 更新
