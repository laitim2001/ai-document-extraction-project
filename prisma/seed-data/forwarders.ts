/**
 * @fileoverview Forwarder 種子數據定義
 * @description
 *   定義系統預設的 Forwarder 清單及其識別模式。
 *   包含 14 個常見的物流/貨代公司，每個都有詳細的識別配置。
 *
 *   識別模式結構：
 *   - names: 公司名稱變體（大小寫不敏感匹配）
 *   - keywords: 獨特的關鍵詞/短語
 *   - formats: 文件格式特徵（正則表達式）
 *   - logoText: Logo 附近常見文字
 *
 * @module prisma/seed-data/forwarders
 * @author Development Team
 * @since Epic 2 - Story 2.3 (Forwarder Auto-Identification)
 * @lastModified 2025-12-18
 */

/**
 * Forwarder 識別模式介面
 */
export interface ForwarderIdentificationPatterns {
  names: string[]
  keywords: string[]
  formats: string[]
  logoText: string[]
}

/**
 * Forwarder 種子數據介面
 */
export interface ForwarderSeedData {
  code: string
  name: string
  displayName: string
  identificationPatterns: ForwarderIdentificationPatterns
  priority: number
}

/**
 * 預定義的 Forwarder 種子數據
 * 按優先級排序（priority 越高越先檢查）
 */
export const FORWARDER_SEED_DATA: ForwarderSeedData[] = [
  // ===========================================
  // Express / Courier Services (High Priority)
  // ===========================================
  {
    code: 'DHL',
    name: 'DHL Express',
    displayName: 'DHL Express',
    identificationPatterns: {
      names: [
        'DHL',
        'DHL Express',
        'DHL Global',
        'DHL International',
        'DHL Supply Chain',
        'DHL Freight',
        'DHL eCommerce',
        'Deutsche Post DHL',
      ],
      keywords: [
        'waybill',
        'awb number',
        'dhl tracking',
        'express worldwide',
        'global forwarding',
        'shipment tracking',
        'delivery notice',
      ],
      formats: [
        '\\d{10}', // DHL tracking number format (10 digits)
        '[A-Z]{3}\\d{7}', // Alternative format
      ],
      logoText: [
        'dhl',
        'simply delivered',
        'express',
        'excellence. simply delivered.',
      ],
    },
    priority: 100,
  },
  {
    code: 'FDX',
    name: 'FedEx',
    displayName: 'FedEx',
    identificationPatterns: {
      names: [
        'FedEx',
        'Federal Express',
        'FedEx Express',
        'FedEx Ground',
        'FedEx Freight',
        'FedEx International',
        'FedEx Trade Networks',
        'FedEx Logistics',
      ],
      keywords: [
        'fedex tracking',
        'door tag',
        'express saver',
        'international priority',
        'ground shipping',
        'freight services',
        'ship manager',
      ],
      formats: [
        '\\d{12}', // FedEx tracking number (12 digits)
        '\\d{15}', // Extended format (15 digits)
        '\\d{20,22}', // FedEx Ground (20-22 digits)
      ],
      logoText: [
        'fedex',
        'federal express',
        'the world on time',
      ],
    },
    priority: 100,
  },
  {
    code: 'UPS',
    name: 'UPS',
    displayName: 'UPS (United Parcel Service)',
    identificationPatterns: {
      names: [
        'UPS',
        'United Parcel Service',
        'UPS Express',
        'UPS Ground',
        'UPS Freight',
        'UPS Supply Chain',
        'UPS International',
      ],
      keywords: [
        'ups tracking',
        'worldship',
        'ground shipping',
        'express critical',
        'freight shipping',
        'ups my choice',
        'package tracking',
      ],
      formats: [
        '1Z[A-Z0-9]{16}', // UPS tracking number format
        '\\d{9}', // UPS Mail Innovations
        '\\d{18}', // UPS Freight
      ],
      logoText: [
        'ups',
        'united parcel service',
        'what can brown do for you',
      ],
    },
    priority: 100,
  },
  {
    code: 'TNT',
    name: 'TNT Express',
    displayName: 'TNT Express',
    identificationPatterns: {
      names: [
        'TNT',
        'TNT Express',
        'TNT International',
        'TNT FedEx',
      ],
      keywords: [
        'tnt tracking',
        'consignment note',
        'express delivery',
        'international express',
      ],
      formats: [
        '[A-Z]{2}\\d{9}[A-Z]{2}', // TNT tracking format
        '\\d{9}',
      ],
      logoText: [
        'tnt',
        'tnt express',
        'sure we can',
      ],
    },
    priority: 95,
  },

  // ===========================================
  // Ocean Carriers (High Priority)
  // ===========================================
  {
    code: 'MAERSK',
    name: 'Maersk',
    displayName: 'Maersk Line',
    identificationPatterns: {
      names: [
        'Maersk',
        'Maersk Line',
        'A.P. Moller-Maersk',
        'Maersk Container Industry',
        'Maersk Logistics',
        'Sealand',
        'Safmarine',
      ],
      keywords: [
        'bill of lading',
        'container number',
        'booking number',
        'vessel name',
        'port of loading',
        'port of discharge',
        'ocean freight',
      ],
      formats: [
        'MSKU\\d{7}', // Maersk container prefix
        'MRKU\\d{7}',
        'SEAL\\d{7}',
        'SFAU\\d{7}',
      ],
      logoText: [
        'maersk',
        'constant care',
      ],
    },
    priority: 90,
  },
  {
    code: 'MSC',
    name: 'MSC',
    displayName: 'Mediterranean Shipping Company',
    identificationPatterns: {
      names: [
        'MSC',
        'Mediterranean Shipping Company',
        'MSC Mediterranean',
        'MSC Cargo',
      ],
      keywords: [
        'msc tracking',
        'bill of lading',
        'container tracking',
        'ocean shipment',
        'vessel schedule',
      ],
      formats: [
        'MSCU\\d{7}', // MSC container prefix
        'MEDU\\d{7}',
      ],
      logoText: [
        'msc',
        'mediterranean shipping',
      ],
    },
    priority: 90,
  },
  {
    code: 'CMACGM',
    name: 'CMA CGM',
    displayName: 'CMA CGM Group',
    identificationPatterns: {
      names: [
        'CMA CGM',
        'CMA CGM Group',
        'APL',
        'ANL',
        'CNC',
      ],
      keywords: [
        'cma cgm tracking',
        'container shipment',
        'ocean freight',
        'vessel booking',
      ],
      formats: [
        'CMAU\\d{7}', // CMA CGM container prefix
        'APLU\\d{7}',
        'ANLU\\d{7}',
      ],
      logoText: [
        'cma cgm',
        'apl',
      ],
    },
    priority: 88,
  },
  {
    code: 'HLAG',
    name: 'Hapag-Lloyd',
    displayName: 'Hapag-Lloyd',
    identificationPatterns: {
      names: [
        'Hapag-Lloyd',
        'Hapag Lloyd',
        'HAPAG',
      ],
      keywords: [
        'hapag lloyd tracking',
        'container booking',
        'ocean transport',
        'shipping line',
      ],
      formats: [
        'HLCU\\d{7}', // Hapag-Lloyd container prefix
        'HLXU\\d{7}',
      ],
      logoText: [
        'hapag-lloyd',
        'quality pays',
      ],
    },
    priority: 88,
  },
  {
    code: 'EVRG',
    name: 'Evergreen',
    displayName: 'Evergreen Marine',
    identificationPatterns: {
      names: [
        'Evergreen',
        'Evergreen Marine',
        'Evergreen Line',
        'EVA Airways Cargo',
      ],
      keywords: [
        'evergreen tracking',
        'container booking',
        'ocean freight',
        'shipping schedule',
      ],
      formats: [
        'EGHU\\d{7}', // Evergreen container prefix
        'EISU\\d{7}',
        'EMCU\\d{7}',
      ],
      logoText: [
        'evergreen',
        'evergreen marine',
      ],
    },
    priority: 85,
  },
  {
    code: 'COSCO',
    name: 'COSCO',
    displayName: 'COSCO Shipping',
    identificationPatterns: {
      names: [
        'COSCO',
        'COSCO Shipping',
        'COSCO Container Lines',
        'OOCL',
      ],
      keywords: [
        'cosco tracking',
        'container shipment',
        'ocean carrier',
        'shipping booking',
      ],
      formats: [
        'COSU\\d{7}', // COSCO container prefix
        'CBHU\\d{7}',
        'OOLU\\d{7}', // OOCL prefix
      ],
      logoText: [
        'cosco',
        'cosco shipping',
        'oocl',
      ],
    },
    priority: 85,
  },
  {
    code: 'ONE',
    name: 'ONE',
    displayName: 'Ocean Network Express',
    identificationPatterns: {
      names: [
        'ONE',
        'Ocean Network Express',
        'ONE Line',
      ],
      keywords: [
        'one tracking',
        'container booking',
        'ocean network',
        'vessel schedule',
      ],
      formats: [
        'ONEY\\d{7}', // ONE container prefix
        'ONEU\\d{7}',
      ],
      logoText: [
        'one',
        'ocean network express',
        'as one we can',
      ],
    },
    priority: 85,
  },
  {
    code: 'YML',
    name: 'Yang Ming',
    displayName: 'Yang Ming Marine',
    identificationPatterns: {
      names: [
        'Yang Ming',
        'Yang Ming Marine',
        'Yang Ming Line',
        'YM Line',
      ],
      keywords: [
        'yang ming tracking',
        'container shipment',
        'ocean freight',
        'booking reference',
      ],
      formats: [
        'YMLU\\d{7}', // Yang Ming container prefix
        'YMMU\\d{7}',
      ],
      logoText: [
        'yang ming',
        'ym line',
      ],
    },
    priority: 83,
  },

  // ===========================================
  // Regional / Local Forwarders
  // ===========================================
  {
    code: 'SF',
    name: 'SF Express',
    displayName: 'SF Express (順豐)',
    identificationPatterns: {
      names: [
        'SF Express',
        'S.F. Express',
        '順豐',
        '順豐速運',
        'SF International',
      ],
      keywords: [
        'sf tracking',
        '順豐單號',
        'express delivery',
        '快遞單',
        'waybill number',
      ],
      formats: [
        'SF\\d{12}', // SF tracking format
        '\\d{12}',
      ],
      logoText: [
        'sf express',
        '順豐',
        'sf',
      ],
    },
    priority: 80,
  },
  {
    code: 'KERRY',
    name: 'Kerry Logistics',
    displayName: 'Kerry Logistics',
    identificationPatterns: {
      names: [
        'Kerry Logistics',
        'Kerry TJ Logistics',
        'Kerry Express',
        'Kerry EAS',
        '嘉里物流',
        '嘉里大榮',
      ],
      keywords: [
        'kerry tracking',
        'logistics services',
        'freight forwarding',
        '物流追蹤',
      ],
      formats: [
        'KL\\d{10}',
        '\\d{10}',
      ],
      logoText: [
        'kerry',
        'kerry logistics',
        '嘉里',
      ],
    },
    priority: 78,
  },

  // ===========================================
  // Unknown / Manual Review
  // ===========================================
  {
    code: 'UNKNOWN',
    name: 'Unknown',
    displayName: 'Unknown Forwarder',
    identificationPatterns: {
      names: [],
      keywords: [],
      formats: [],
      logoText: [],
    },
    priority: 0,
  },
]

/**
 * 根據 code 查找 Forwarder 種子數據
 * @param code - Forwarder 代碼
 * @returns ForwarderSeedData 或 undefined
 */
export function getForwarderByCode(code: string): ForwarderSeedData | undefined {
  return FORWARDER_SEED_DATA.find((f) => f.code === code)
}

/**
 * 獲取所有活躍的 Forwarder（排除 Unknown）
 * @returns 活躍的 Forwarder 清單
 */
export function getActiveForwarders(): ForwarderSeedData[] {
  return FORWARDER_SEED_DATA.filter((f) => f.code !== 'UNKNOWN')
}
