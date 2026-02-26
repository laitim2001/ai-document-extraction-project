'use client';

/**
 * @fileoverview Extraction 方案對比測試頁面
 * @description
 *   對比測試兩種提取架構：
 *   - 方案 A: Extraction V2 (Azure DI + GPT-mini)
 *   - 方案 B: 純 GPT-5.2 Vision 直接提取
 *
 * @module src/app/[locale]/(dashboard)/admin/test/extraction-compare
 * @since CHANGE-020 - Architecture Comparison Test
 */

import * as React from 'react';
import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  Trophy,
  AlertCircle,
  FileText,
  Loader2,
  Scale,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface ExtractedField {
  value: string | number | null;
  confidence: number;
  source?: string;
}

interface ApproachResult {
  name: string;
  success: boolean;
  fields: Record<string, ExtractedField>;
  fieldsExtracted: number;
  totalFields: number;
  processingTimeMs: number;
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };
  details?: Record<string, unknown>;
  error?: string;
}

interface ComparisonResult {
  fileName: string;
  fileSize: number;
  approachA: ApproachResult;
  approachB: ApproachResult;
  summary: {
    winner: 'A' | 'B' | 'tie';
    reason: string;
    speedDifferenceMs: number;
    speedDifferencePercent: number;
    fieldsDifference: number;
    recommendation: string;
  };
}

// ============================================================
// Component
// ============================================================

export default function ExtractionComparePage() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dropzone 配置
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

  // 執行對比測試
  const runComparison = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/test/extraction-compare', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.comparison);
      } else {
        setError(data.error || 'Unknown error occurred');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run comparison');
    } finally {
      setIsProcessing(false);
    }
  };

  // 格式化時間
  const formatTime = (ms: number) => {
    return (ms / 1000).toFixed(2) + 's';
  };

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    return (bytes / 1024).toFixed(1) + ' KB';
  };

  // 獲取勝者徽章
  const getWinnerBadge = (approach: 'A' | 'B', winner: 'A' | 'B' | 'tie') => {
    if (winner === approach) {
      return (
        <Badge className="bg-green-500 ml-2">
          <Trophy className="h-3 w-3 mr-1" />
          Winner
        </Badge>
      );
    }
    if (winner === 'tie') {
      return (
        <Badge variant="secondary" className="ml-2">
          <Scale className="h-3 w-3 mr-1" />
          Tie
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Extraction Architecture Comparison</h1>
        <p className="text-muted-foreground mt-2">
          Compare Extraction V2 (Azure DI + GPT) vs Pure GPT-5.2 Vision
        </p>
      </div>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Document</CardTitle>
          <CardDescription>
            Upload a PDF or image file to compare both extraction approaches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {isDragActive
                  ? 'Drop the file here'
                  : 'Drag & drop a file here, or click to select'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports: PDF, JPEG, PNG, TIFF
              </p>
            </div>

            {file && (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button onClick={runComparison} disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Run Comparison
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-red-500">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary Card */}
          <Card
            className={
              result.summary.winner === 'A'
                ? 'border-blue-500'
                : result.summary.winner === 'B'
                  ? 'border-green-500'
                  : 'border-yellow-500'
            }
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Comparison Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <p className="text-sm text-muted-foreground">Approach A</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {result.approachA.fieldsExtracted}/{result.approachA.totalFields}
                    </p>
                    <p className="text-sm">{formatTime(result.approachA.processingTimeMs)}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg flex items-center justify-center">
                    <span className="text-3xl font-bold">VS</span>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <p className="text-sm text-muted-foreground">Approach B</p>
                    <p className="text-2xl font-bold text-green-600">
                      {result.approachB.fieldsExtracted}/{result.approachB.totalFields}
                    </p>
                    <p className="text-sm">{formatTime(result.approachB.processingTimeMs)}</p>
                  </div>
                </div>

                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium mb-2">{result.summary.reason}</p>
                  <p className="text-sm text-muted-foreground">
                    {result.summary.recommendation}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Speed Difference:</span>{' '}
                    <span
                      className={
                        result.summary.speedDifferenceMs > 0 ? 'text-green-600' : 'text-blue-600'
                      }
                    >
                      {result.summary.speedDifferenceMs > 0 ? 'B faster by ' : 'A faster by '}
                      {Math.abs(result.summary.speedDifferenceMs)}ms (
                      {Math.abs(result.summary.speedDifferencePercent)}%)
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fields Difference:</span>{' '}
                    <span>
                      {result.summary.fieldsDifference === 0
                        ? 'Same'
                        : result.summary.fieldsDifference > 0
                          ? `A +${result.summary.fieldsDifference}`
                          : `B +${Math.abs(result.summary.fieldsDifference)}`}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Comparison */}
          <div className="grid grid-cols-2 gap-6">
            {/* Approach A */}
            <Card className="border-blue-200">
              <CardHeader className="bg-blue-50 dark:bg-blue-950">
                <CardTitle className="text-blue-700 dark:text-blue-300 flex items-center">
                  Approach A: Extraction V2
                  {getWinnerBadge('A', result.summary.winner)}
                </CardTitle>
                <CardDescription>Azure DI + GPT-mini</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-muted-foreground">Fields</p>
                      <p className="font-bold">
                        {result.approachA.fieldsExtracted}/{result.approachA.totalFields}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-muted-foreground">Time</p>
                      <p className="font-bold">
                        {formatTime(result.approachA.processingTimeMs)}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-muted-foreground">Tokens</p>
                      <p className="font-bold">
                        {result.approachA.tokensUsed?.total || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Fields Table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Conf.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(result.approachA.fields).map(([key, field]) => (
                        <TableRow key={key}>
                          <TableCell className="font-medium">{key}</TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {field.value !== null ? String(field.value) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                field.confidence >= 85
                                  ? 'default'
                                  : field.confidence >= 70
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {Math.round(field.confidence)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Details */}
                  {result.approachA.details && (
                    <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                      <p>
                        Azure DI:{' '}
                        {(result.approachA.details.azureDI as Record<string, number>)?.keyValuePairs} KV pairs,{' '}
                        {(result.approachA.details.azureDI as Record<string, number>)?.tables} tables
                      </p>
                      <p>Quality: {String(result.approachA.details.quality)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Approach B */}
            <Card className="border-green-200">
              <CardHeader className="bg-green-50 dark:bg-green-950">
                <CardTitle className="text-green-700 dark:text-green-300 flex items-center">
                  Approach B: Pure GPT Vision
                  {getWinnerBadge('B', result.summary.winner)}
                </CardTitle>
                <CardDescription>GPT-5.2 Direct Extraction</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-muted-foreground">Fields</p>
                      <p className="font-bold">
                        {result.approachB.fieldsExtracted}/{result.approachB.totalFields}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-muted-foreground">Time</p>
                      <p className="font-bold">
                        {formatTime(result.approachB.processingTimeMs)}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-muted rounded">
                      <p className="text-muted-foreground">Conf.</p>
                      <p className="font-bold">
                        {result.approachB.details?.confidence
                          ? Math.round(Number(result.approachB.details.confidence) * 100) + '%'
                          : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Fields Table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Field</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Conf.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(result.approachB.fields).map(([key, field]) => (
                        <TableRow key={key}>
                          <TableCell className="font-medium">{key}</TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {field.value !== null ? String(field.value) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                field.confidence >= 85
                                  ? 'default'
                                  : field.confidence >= 70
                                    ? 'secondary'
                                    : 'outline'
                              }
                            >
                              {Math.round(field.confidence)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Details */}
                  {result.approachB.details && (
                    <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                      <p>Pages: {String(result.approachB.details.pageCount)}</p>
                      <p>Line Items: {String(result.approachB.details.hasLineItems)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
