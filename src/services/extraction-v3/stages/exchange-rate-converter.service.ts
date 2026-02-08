/**
 * @fileoverview Exchange Rate Converter 服務
 * @description
 *   在 extraction pipeline 的 Stage 3 後、TERM_RECORDING 前執行，
 *   將提取的金額轉換為配置的目標貨幣。
 *   功能預設關閉，由 PipelineConfig 控制。
 *
 * @module src/services/extraction-v3/stages/exchange-rate-converter
 * @since CHANGE-032 - Pipeline Reference Number Matching & FX Conversion
 * @lastModified 2026-02-08
 *
 * @features
 *   - 轉換 totalAmount, subtotal 等標準欄位
 *   - 可選轉換 lineItems 和 extraCharges
 *   - 可配置的精度和 fallback 行為
 *   - 原始值不被取代，轉換值作為額外欄位
 *   - 非阻塞：失敗依 fallback 策略處理
 *
 * @dependencies
 *   - src/services/exchange-rate.service.ts - convert
 *   - src/types/extraction-v3.types.ts - ExchangeRateConversionResult
 *
 * @related
 *   - src/services/pipeline-config.service.ts - 配置解析
 *   - src/services/extraction-v3/extraction-v3.service.ts - 主 pipeline
 */

import { convert } from '@/services/exchange-rate.service';
import type {
  EffectivePipelineConfig,
  ExchangeRateConversionResult,
  FxConversionItem,
  Stage3ExtractionResult,
} from '@/types/extraction-v3.types';

// ============================================================================
// Service Class
// ============================================================================

export class ExchangeRateConverterService {
  /**
   * 執行匯率轉換
   *
   * @param input - 轉換輸入參數
   * @returns 轉換結果
   */
  async convert(input: {
    stage3Result: Stage3ExtractionResult;
    config: EffectivePipelineConfig;
  }): Promise<ExchangeRateConversionResult> {
    const startTime = Date.now();
    const { stage3Result, config } = input;

    // 功能未啟用
    if (!config.fxConversionEnabled) {
      return {
        enabled: false,
        conversions: [],
        warnings: [],
        processingTimeMs: Date.now() - startTime,
      };
    }

    const targetCurrency = config.fxTargetCurrency;
    if (!targetCurrency) {
      return {
        enabled: true,
        conversions: [],
        warnings: ['FX conversion enabled but no target currency configured'],
        processingTimeMs: Date.now() - startTime,
      };
    }

    // 讀取來源貨幣
    const sourceCurrency = stage3Result.standardFields.currency?.value?.toString();
    if (!sourceCurrency) {
      return {
        enabled: true,
        conversions: [],
        sourceCurrency: undefined,
        targetCurrency,
        warnings: ['No source currency found in extracted data'],
        processingTimeMs: Date.now() - startTime,
      };
    }

    // 相同貨幣不需要轉換
    if (sourceCurrency.toUpperCase() === targetCurrency.toUpperCase()) {
      return {
        enabled: true,
        conversions: [],
        sourceCurrency,
        targetCurrency,
        warnings: [],
        processingTimeMs: Date.now() - startTime,
      };
    }

    const conversions: FxConversionItem[] = [];
    const warnings: string[] = [];
    const precision = config.fxRoundingPrecision;

    // 轉換標準金額欄位
    await this.convertStandardFields(
      stage3Result,
      sourceCurrency,
      targetCurrency,
      precision,
      config.fxFallbackBehavior,
      conversions,
      warnings
    );

    // 轉換 lineItems
    if (config.fxConvertLineItems && stage3Result.lineItems?.length > 0) {
      await this.convertLineItems(
        stage3Result,
        sourceCurrency,
        targetCurrency,
        precision,
        config.fxFallbackBehavior,
        conversions,
        warnings
      );
    }

    // 轉換 extraCharges
    if (config.fxConvertExtraCharges && stage3Result.extraCharges?.length) {
      await this.convertExtraCharges(
        stage3Result,
        sourceCurrency,
        targetCurrency,
        precision,
        config.fxFallbackBehavior,
        conversions,
        warnings
      );
    }

    return {
      enabled: true,
      conversions,
      sourceCurrency,
      targetCurrency,
      warnings,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * 轉換標準欄位（totalAmount, subtotal）
   */
  private async convertStandardFields(
    stage3Result: Stage3ExtractionResult,
    sourceCurrency: string,
    targetCurrency: string,
    precision: number,
    fallbackBehavior: string,
    conversions: FxConversionItem[],
    warnings: string[]
  ): Promise<void> {
    const amountFields = [
      { field: 'totalAmount', path: 'standardFields.totalAmount' },
      { field: 'subtotal', path: 'standardFields.subtotal' },
    ];

    for (const { field, path } of amountFields) {
      const fieldValue = stage3Result.standardFields[field as keyof typeof stage3Result.standardFields];
      if (!fieldValue?.value) continue;

      const amount = parseFloat(String(fieldValue.value));
      if (isNaN(amount)) continue;

      try {
        const result = await convert(sourceCurrency, targetCurrency, amount);
        conversions.push({
          field,
          originalAmount: amount,
          originalCurrency: sourceCurrency,
          convertedAmount: this.round(result.convertedAmount, precision),
          targetCurrency,
          rate: result.rate,
          path,
        });
      } catch (error) {
        this.handleConversionError(
          error,
          field,
          fallbackBehavior,
          warnings
        );
      }
    }
  }

  /**
   * 轉換 lineItems
   */
  private async convertLineItems(
    stage3Result: Stage3ExtractionResult,
    sourceCurrency: string,
    targetCurrency: string,
    precision: number,
    fallbackBehavior: string,
    conversions: FxConversionItem[],
    warnings: string[]
  ): Promise<void> {
    for (let i = 0; i < stage3Result.lineItems.length; i++) {
      const item = stage3Result.lineItems[i];
      if (item.amount === undefined || item.amount === null) continue;

      try {
        const result = await convert(sourceCurrency, targetCurrency, item.amount);
        conversions.push({
          field: 'lineItem.amount',
          originalAmount: item.amount,
          originalCurrency: sourceCurrency,
          convertedAmount: this.round(result.convertedAmount, precision),
          targetCurrency,
          rate: result.rate,
          path: `lineItems[${i}].amount`,
        });
      } catch (error) {
        this.handleConversionError(
          error,
          `lineItems[${i}].amount`,
          fallbackBehavior,
          warnings
        );
      }
    }
  }

  /**
   * 轉換 extraCharges
   */
  private async convertExtraCharges(
    stage3Result: Stage3ExtractionResult,
    sourceCurrency: string,
    targetCurrency: string,
    precision: number,
    fallbackBehavior: string,
    conversions: FxConversionItem[],
    warnings: string[]
  ): Promise<void> {
    const charges = stage3Result.extraCharges || [];
    for (let i = 0; i < charges.length; i++) {
      const charge = charges[i];
      if (charge.amount === undefined || charge.amount === null) continue;

      // extraCharge 可能有自己的貨幣
      const chargeCurrency = charge.currency || sourceCurrency;
      if (chargeCurrency.toUpperCase() === targetCurrency.toUpperCase()) continue;

      try {
        const result = await convert(chargeCurrency, targetCurrency, charge.amount);
        conversions.push({
          field: 'extraCharge.amount',
          originalAmount: charge.amount,
          originalCurrency: chargeCurrency,
          convertedAmount: this.round(result.convertedAmount, precision),
          targetCurrency,
          rate: result.rate,
          path: `extraCharges[${i}].amount`,
        });
      } catch (error) {
        this.handleConversionError(
          error,
          `extraCharges[${i}].amount`,
          fallbackBehavior,
          warnings
        );
      }
    }
  }

  /**
   * 處理轉換錯誤
   */
  private handleConversionError(
    error: unknown,
    field: string,
    fallbackBehavior: string,
    warnings: string[]
  ): void {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    if (fallbackBehavior === 'error') {
      throw new Error(`FX conversion failed for ${field}: ${errorMsg}`);
    }

    warnings.push(`FX conversion skipped for ${field}: ${errorMsg}`);
  }

  /**
   * 四捨五入到指定精度
   */
  private round(value: number, precision: number): number {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
  }
}
