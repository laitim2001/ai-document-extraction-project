'use client';

/**
 * @fileoverview Extraction V2 測試頁面
 * @description
 *   提供視覺化界面測試新提取架構（CHANGE-020）：
 *   - 上傳文件
 *   - 查看 Azure DI 原始返回
 *   - 查看精選後的 GPT 輸入
 *   - 查看 GPT 提取結果
 *   - 比較各階段處理時間
 *
 * @module src/app/[locale]/(dashboard)/admin/test/extraction-v2
 * @since CHANGE-020 - Extraction V2 Architecture
 * @lastModified 2026-01-29
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, CheckCircle2, XCircle, AlertCircle, Clock, Zap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// ============================================================
// Types
// ============================================================

interface ExtractionResult {
  success: boolean;
  data?: {
    azureDI: {
      success: boolean;
      keyValuePairsCount: number;
      tablesCount: number;
      pageCount: number;
      confidence: number;
      processingTimeMs: number;
      keyValuePairs: Array<{
        key: string;
        value: string;
        confidence: number;
      }>;
      tables: Array<{
        index: number;
        rowCount: number;
        columnCount: number;
        headers: string[];
      }>;
    };
    selectedData: {
      markdown: string;
      tokenEstimate: number;
      keyValuePairsCount: number;
      tablesCount: number;
      truncated: boolean;
    };
    qualityAnalysis: {
      overallQuality: string;
      keyValuePairsQuality: string;
      hasUsefulTables: boolean;
      avgConfidence: number;
      recommendations: string[];
    };
    gptExtraction: {
      success: boolean;
      fields: Record<
        string,
        {
          value: string | number | null;
          confidence: number;
          source: string;
          originalLabel?: string;
        }
      >;
      tokensUsed: {
        input: number;
        output: number;
        total: number;
      };
      processingTimeMs: number;
      modelUsed: string;
    };
    totalProcessingTimeMs: number;
  };
  error?: string;
}

interface ConfigStatus {
  azureDI: {
    configured: boolean;
    missing: string[];
  };
  gptMini: {
    configured: boolean;
    missing: string[];
    deploymentName: string;
  };
}

// ============================================================
// Components
// ============================================================

function QualityBadge({ quality }: { quality: string }) {
  const colorMap: Record<string, string> = {
    high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    low: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  return (
    <Badge className={colorMap[quality] ?? 'bg-gray-100'}>
      {quality.toUpperCase()}
    </Badge>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const percent = Math.round(confidence * 100);
  let color = 'bg-red-100 text-red-800';
  if (percent >= 80) color = 'bg-green-100 text-green-800';
  else if (percent >= 60) color = 'bg-yellow-100 text-yellow-800';
  return <Badge className={color}>{percent}%</Badge>;
}

function ProcessingTime({ ms }: { ms: number }) {
  return (
    <span className="flex items-center gap-1 text-sm text-muted-foreground">
      <Clock className="h-3 w-3" />
      {(ms / 1000).toFixed(2)}s
    </span>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function ExtractionV2TestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 檢查配置狀態
  const checkConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/test/extraction-v2');
      const data = await res.json();
      setConfigStatus(data);
    } catch (err) {
      console.error('Failed to check config:', err);
    }
  }, []);

  // 初始載入時檢查配置
  React.useEffect(() => {
    checkConfig();
  }, [checkConfig]);

  // 文件上傳處理
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setResult(null);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/tiff': ['.tif', '.tiff'],
    },
    maxFiles: 1,
  });

  // 執行提取
  const handleExtract = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/test/extraction-v2', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      setResult(data);

      if (!data.success) {
        setError(data.error ?? 'Extraction failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 頁面標題 */}
      <div>
        <h1 className="text-2xl font-bold">Extraction V2 Test</h1>
        <p className="text-muted-foreground">
          Test the new extraction architecture: Azure DI prebuilt-document + GPT-5-mini
        </p>
      </div>

      {/* 配置狀態 */}
      {configStatus && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {configStatus.azureDI.configured ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                Azure DI (prebuilt-document)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {configStatus.azureDI.configured ? (
                <Badge variant="outline" className="text-green-600">Configured</Badge>
              ) : (
                <p className="text-sm text-red-600">
                  Missing: {configStatus.azureDI.missing.join(', ')}
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {configStatus.gptMini.configured ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                GPT-mini ({configStatus.gptMini.deploymentName})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {configStatus.gptMini.configured ? (
                <Badge variant="outline" className="text-green-600">Configured</Badge>
              ) : (
                <p className="text-sm text-red-600">
                  Missing: {configStatus.gptMini.missing.join(', ')}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 文件上傳區 */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
          <CardDescription>
            Upload a PDF or image file to test the extraction pipeline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
              transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
              hover:border-primary hover:bg-primary/5
            `}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p>Drop the file here...</p>
            ) : (
              <div>
                <p className="font-medium">Drag & drop a file here, or click to select</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports: PDF, JPEG, PNG, TIFF
                </p>
              </div>
            )}
          </div>

          {file && (
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <Button onClick={handleExtract} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Zap className="mr-2 h-4 w-4" />
                    Extract
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 錯誤顯示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 結果顯示 */}
      {result?.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Extraction Results</span>
              <ProcessingTime ms={result.data.totalProcessingTimeMs} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="azure-di">Azure DI</TabsTrigger>
                <TabsTrigger value="gpt-input">GPT Input</TabsTrigger>
                <TabsTrigger value="extracted">Extracted Fields</TabsTrigger>
              </TabsList>

              {/* 摘要 */}
              <TabsContent value="summary" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Quality</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <QualityBadge quality={result.data.qualityAnalysis.overallQuality} />
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Key-Value Pairs</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <span className="text-2xl font-bold">
                        {result.data.azureDI.keyValuePairsCount}
                      </span>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Tables</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <span className="text-2xl font-bold">
                        {result.data.azureDI.tablesCount}
                      </span>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">GPT Tokens</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <span className="text-2xl font-bold">
                        {result.data.gptExtraction.tokensUsed.total}
                      </span>
                    </CardContent>
                  </Card>
                </div>

                {/* 建議 */}
                {result.data.qualityAnalysis.recommendations.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Recommendations</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc list-inside">
                        {result.data.qualityAnalysis.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* 處理時間分解 */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Processing Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span>Azure DI</span>
                        <ProcessingTime ms={result.data.azureDI.processingTimeMs} />
                      </div>
                      <div className="flex justify-between items-center">
                        <span>GPT Extraction</span>
                        <ProcessingTime ms={result.data.gptExtraction.processingTimeMs} />
                      </div>
                      <div className="flex justify-between items-center font-bold border-t pt-2">
                        <span>Total</span>
                        <ProcessingTime ms={result.data.totalProcessingTimeMs} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Azure DI 結果 */}
              <TabsContent value="azure-di" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Key-Value Pairs</CardTitle>
                      <CardDescription>
                        {result.data.azureDI.keyValuePairsCount} pairs detected
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[300px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Key</TableHead>
                              <TableHead>Value</TableHead>
                              <TableHead>Conf.</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {result.data.azureDI.keyValuePairs.map((kvp, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{kvp.key}</TableCell>
                                <TableCell>{kvp.value}</TableCell>
                                <TableCell>
                                  <ConfidenceBadge confidence={kvp.confidence} />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Tables</CardTitle>
                      <CardDescription>
                        {result.data.azureDI.tablesCount} tables detected
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[300px]">
                        {result.data.azureDI.tables.map((table, i) => (
                          <div key={i} className="mb-4 p-3 border rounded">
                            <p className="font-medium mb-2">
                              Table {table.index + 1}: {table.rowCount} rows x {table.columnCount} cols
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Headers: {table.headers.join(', ') || '(none)'}
                            </p>
                          </div>
                        ))}
                        {result.data.azureDI.tables.length === 0 && (
                          <p className="text-muted-foreground">No tables detected</p>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* GPT 輸入 */}
              <TabsContent value="gpt-input">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex justify-between">
                      <span>Selected Data for GPT</span>
                      <Badge variant="outline">
                        ~{result.data.selectedData.tokenEstimate} tokens
                      </Badge>
                    </CardTitle>
                    {result.data.selectedData.truncated && (
                      <CardDescription className="text-yellow-600">
                        Data was truncated to fit token limit
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[400px]">
                      <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded">
                        {result.data.selectedData.markdown}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* 提取的欄位 */}
              <TabsContent value="extracted">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex justify-between">
                      <span>Extracted Fields</span>
                      <Badge variant="outline">
                        Model: {result.data.gptExtraction.modelUsed}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Field</TableHead>
                          <TableHead>Value</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(result.data.gptExtraction.fields).map(
                          ([fieldName, field]) => (
                            <TableRow key={fieldName}>
                              <TableCell className="font-medium">{fieldName}</TableCell>
                              <TableCell>
                                {field.value !== null ? String(field.value) : (
                                  <span className="text-muted-foreground italic">null</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <ConfidenceBadge confidence={field.confidence} />
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{field.source}</Badge>
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
