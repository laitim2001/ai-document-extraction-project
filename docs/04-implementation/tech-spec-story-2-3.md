# Story 2-3: Forwarder Auto Identification - Technical Specification

**Version:** 1.0
**Created:** 2025-12-16
**Status:** Ready for Development
**Story Key:** 2-3-forwarder-auto-identification

---

## Overview

| Field | Value |
|-------|-------|
| Story ID | 2.3 |
| Epic | Epic 2: Manual Invoice Upload & AI Processing |
| Estimated Effort | Medium |
| Dependencies | Story 2.2 (OCR extraction results) |
| Blocking | Story 2.4 ~ 2.7 |
| FR Coverage | FR5 |

---

## Objective

Implement an automatic Forwarder identification system that analyzes OCR-extracted text to identify the source Forwarder (shipping company) of invoice documents. High-confidence matches (≥80%) are automatically associated, while low-confidence or no-match cases are queued for manual assignment.

---

## Acceptance Criteria Mapping

| AC | Description | Technical Implementation |
|----|-------------|-------------------------|
| AC1 | Forwarder identification logic | Pattern matching with confidence scoring |
| AC2 | High confidence auto-association | Auto-link when confidence ≥ 80% |
| AC3 | Low confidence handling | Queue for manual Forwarder assignment |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Forwarder Identification Flow                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │   OcrResult  │────▶│   Python     │────▶│  ForwarderIdentification │ │
│  │   (text)     │     │   Mapping    │     │  (result)                │ │
│  └──────────────┘     │   Service    │     └──────────────────────────┘ │
│                       └──────────────┘                                   │
│                              │                                           │
│         ┌────────────────────┴────────────────────┐                     │
│         │                                          │                     │
│         ▼                                          ▼                     │
│  ┌──────────────┐                         ┌──────────────┐              │
│  │ Confidence   │                         │ Confidence   │              │
│  │   >= 80%     │                         │   < 80%      │              │
│  └──────────────┘                         └──────────────┘              │
│         │                                          │                     │
│         ▼                                          ▼                     │
│  ┌──────────────┐                         ┌──────────────┐              │
│  │ Auto-Link    │                         │ Manual Queue │              │
│  │ to Forwarder │                         │ for Review   │              │
│  └──────────────┘                         └──────────────┘              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Guide

### Phase 1: Database Schema (15 min)

#### Step 1.1: Add Forwarder Models to Prisma

Update `prisma/schema.prisma`:

```prisma
// ===========================================
// Forwarder Management Models
// ===========================================

model Forwarder {
  id                    String          @id @default(uuid())
  name                  String          @unique
  code                  String          @unique    // Short code: "DHL", "FDX", "UPS"
  displayName           String          @map("display_name")

  // Identification Configuration
  identificationPatterns Json           @map("identification_patterns")
  // Structure: {
  //   names: string[],      // Company name variations
  //   keywords: string[],   // Unique keywords/phrases
  //   formats: string[],    // Document format patterns (regex)
  //   logoText: string[]    // Text typically near logos
  // }

  // Settings
  isActive              Boolean         @default(true) @map("is_active")
  priority              Int             @default(0)    // Higher = checked first

  // Timestamps
  createdAt             DateTime        @default(now()) @map("created_at")
  updatedAt             DateTime        @updatedAt @map("updated_at")

  // Relations
  documents             Document[]
  mappingRules          MappingRule[]
  identifications       ForwarderIdentification[]

  @@index([code])
  @@index([isActive])
  @@map("forwarders")
}

model ForwarderIdentification {
  id              String      @id @default(uuid())
  documentId      String      @map("document_id")
  forwarderId     String?     @map("forwarder_id")

  // Identification Result
  confidence      Float       // 0-100 percentage
  matchMethod     String      @map("match_method")     // "name", "keyword", "format", "manual"
  matchedPatterns String[]    @map("matched_patterns") // Patterns that matched
  matchDetails    Json?       @map("match_details")    // Detailed match info

  // Processing Info
  isAutoMatched   Boolean     @default(true) @map("is_auto_matched")
  isManual        Boolean     @default(false) @map("is_manual")
  manualAssignedBy String?    @map("manual_assigned_by")
  manualAssignedAt DateTime?  @map("manual_assigned_at")

  // Status
  status          IdentificationStatus @default(PENDING)

  // Timestamps
  createdAt       DateTime    @default(now()) @map("created_at")
  updatedAt       DateTime    @updatedAt @map("updated_at")

  // Relations
  document        Document    @relation(fields: [documentId], references: [id], onDelete: Cascade)
  forwarder       Forwarder?  @relation(fields: [forwarderId], references: [id])
  assignedBy      User?       @relation(fields: [manualAssignedBy], references: [id])

  @@unique([documentId])
  @@index([documentId])
  @@index([forwarderId])
  @@index([status])
  @@index([confidence])
  @@map("forwarder_identifications")
}

enum IdentificationStatus {
  PENDING           // Awaiting identification
  IDENTIFIED        // Successfully identified (auto or manual)
  NEEDS_REVIEW      // Low confidence, needs manual review
  UNIDENTIFIED      // Could not identify, no match
  FAILED            // Identification process failed
}
```

#### Step 1.2: Update Document Model Relations

Add to existing Document model:

```prisma
model Document {
  // ... existing fields ...

  // Forwarder relation
  forwarderId         String?     @map("forwarder_id")
  forwarder           Forwarder?  @relation(fields: [forwarderId], references: [id])

  // ... existing relations ...
  identifications     ForwarderIdentification[]

  @@index([forwarderId])
}
```

#### Step 1.3: Run Migration

```bash
npx prisma migrate dev --name add_forwarder_identification
npx prisma generate
```

---

### Phase 2: Forwarder Seed Data (15 min)

#### Step 2.1: Create Seed Data File

Create `prisma/seed-data/forwarders.ts`:

```typescript
/**
 * Forwarder seed data with identification patterns
 */

export interface ForwarderSeedData {
  name: string
  code: string
  displayName: string
  priority: number
  identificationPatterns: {
    names: string[]
    keywords: string[]
    formats?: string[]
    logoText?: string[]
  }
}

export const forwarderSeeds: ForwarderSeedData[] = [
  {
    name: 'DHL Express',
    code: 'DHL',
    displayName: 'DHL Express',
    priority: 10,
    identificationPatterns: {
      names: [
        'DHL Express',
        'DHL International',
        'DHL Global Forwarding',
        'DHL Supply Chain',
        'DHL Freight'
      ],
      keywords: [
        'DHL WAYBILL',
        'DHL SHIPMENT',
        'EXPRESS WORLDWIDE',
        'DHL EXPRESS',
        'DHL.COM'
      ],
      formats: [
        '^\\d{10}$',  // 10-digit tracking number
        '^JD\\d{18}$' // JD prefix tracking
      ],
      logoText: ['DHL', 'DEUTSCHE POST']
    }
  },
  {
    name: 'FedEx',
    code: 'FDX',
    displayName: 'FedEx',
    priority: 10,
    identificationPatterns: {
      names: [
        'FedEx',
        'Federal Express',
        'FedEx Express',
        'FedEx Ground',
        'FedEx Freight'
      ],
      keywords: [
        'FEDEX',
        'FEDERAL EXPRESS',
        'TRACKING NUMBER',
        'FEDEX.COM',
        'FEDEX EXPRESS SAVER'
      ],
      formats: [
        '^\\d{12}$',        // 12-digit tracking
        '^\\d{15}$',        // 15-digit tracking
        '^96\\d{20}$'       // 96 prefix
      ],
      logoText: ['FedEx', 'FEDERAL EXPRESS']
    }
  },
  {
    name: 'UPS',
    code: 'UPS',
    displayName: 'UPS',
    priority: 10,
    identificationPatterns: {
      names: [
        'UPS',
        'United Parcel Service',
        'UPS Supply Chain',
        'UPS Freight'
      ],
      keywords: [
        'UPS',
        'UNITED PARCEL SERVICE',
        'UPS.COM',
        'TRACKING#',
        'UPS GROUND'
      ],
      formats: [
        '^1Z[A-Z0-9]{16}$',  // 1Z tracking format
        '^T\\d{10}$'         // T prefix
      ],
      logoText: ['UPS', 'UNITED PARCEL']
    }
  },
  {
    name: 'Maersk',
    code: 'MAERSK',
    displayName: 'Maersk Line',
    priority: 8,
    identificationPatterns: {
      names: [
        'Maersk',
        'Maersk Line',
        'A.P. Moller-Maersk',
        'Maersk Logistics'
      ],
      keywords: [
        'MAERSK',
        'CONTAINER',
        'BILL OF LADING',
        'B/L NO',
        'MAERSK.COM'
      ],
      formats: [
        '^MSKU\\d{7}$',      // MSKU container
        '^MRKU\\d{7}$'       // MRKU container
      ],
      logoText: ['MAERSK']
    }
  },
  {
    name: 'MSC',
    code: 'MSC',
    displayName: 'Mediterranean Shipping Company',
    priority: 8,
    identificationPatterns: {
      names: [
        'MSC',
        'Mediterranean Shipping Company',
        'MSC Mediterranean'
      ],
      keywords: [
        'MSC',
        'MEDITERRANEAN SHIPPING',
        'BILL OF LADING',
        'MSC.COM'
      ],
      formats: [
        '^MSCU\\d{7}$',      // MSCU container
        '^MEDU\\d{7}$'       // MEDU container
      ],
      logoText: ['MSC']
    }
  },
  {
    name: 'CMA CGM',
    code: 'CMACGM',
    displayName: 'CMA CGM',
    priority: 8,
    identificationPatterns: {
      names: [
        'CMA CGM',
        'CMA-CGM',
        'CMA CGM Group'
      ],
      keywords: [
        'CMA CGM',
        'CMA-CGM',
        'BILL OF LADING',
        'CMA-CGM.COM'
      ],
      formats: [
        '^CMAU\\d{7}$',      // CMAU container
        '^CGMU\\d{7}$'       // CGMU container
      ],
      logoText: ['CMA CGM']
    }
  },
  {
    name: 'Hapag-Lloyd',
    code: 'HAPAG',
    displayName: 'Hapag-Lloyd',
    priority: 7,
    identificationPatterns: {
      names: [
        'Hapag-Lloyd',
        'Hapag Lloyd',
        'HAPAG-LLOYD'
      ],
      keywords: [
        'HAPAG-LLOYD',
        'HAPAG LLOYD',
        'BILL OF LADING',
        'HAPAG-LLOYD.COM'
      ],
      formats: [
        '^HLCU\\d{7}$',      // HLCU container
        '^HLXU\\d{7}$'       // HLXU container
      ],
      logoText: ['HAPAG-LLOYD', 'HAPAG LLOYD']
    }
  },
  {
    name: 'Evergreen',
    code: 'EVER',
    displayName: 'Evergreen Marine',
    priority: 7,
    identificationPatterns: {
      names: [
        'Evergreen',
        'Evergreen Marine',
        'Evergreen Line',
        'EVERGREEN MARINE'
      ],
      keywords: [
        'EVERGREEN',
        'EVERGREEN LINE',
        'BILL OF LADING',
        'EVERGREEN-MARINE.COM'
      ],
      formats: [
        '^EGHU\\d{7}$',      // EGHU container
        '^EISU\\d{7}$'       // EISU container
      ],
      logoText: ['EVERGREEN']
    }
  },
  {
    name: 'COSCO',
    code: 'COSCO',
    displayName: 'COSCO Shipping',
    priority: 7,
    identificationPatterns: {
      names: [
        'COSCO',
        'COSCO Shipping',
        'COSCO Container Lines',
        'OOCL'  // COSCO acquired OOCL
      ],
      keywords: [
        'COSCO',
        'COSCO SHIPPING',
        'OOCL',
        'BILL OF LADING'
      ],
      formats: [
        '^COSU\\d{7}$',      // COSU container
        '^OOLU\\d{7}$'       // OOLU container (OOCL)
      ],
      logoText: ['COSCO', 'OOCL']
    }
  },
  {
    name: 'ONE',
    code: 'ONE',
    displayName: 'Ocean Network Express',
    priority: 7,
    identificationPatterns: {
      names: [
        'ONE',
        'Ocean Network Express',
        'ONE Line'
      ],
      keywords: [
        'OCEAN NETWORK EXPRESS',
        'ONE LINE',
        'ONE-LINE.COM'
      ],
      formats: [
        '^ONEY\\d{7}$',      // ONEY container
        '^TCNU\\d{7}$'       // TCNU container
      ],
      logoText: ['ONE', 'OCEAN NETWORK EXPRESS']
    }
  },
  {
    name: 'Yang Ming',
    code: 'YANGMING',
    displayName: 'Yang Ming Marine',
    priority: 6,
    identificationPatterns: {
      names: [
        'Yang Ming',
        'Yang Ming Marine',
        'Yang Ming Line'
      ],
      keywords: [
        'YANG MING',
        'YANGMING',
        'BILL OF LADING'
      ],
      formats: [
        '^YMLU\\d{7}$'       // YMLU container
      ],
      logoText: ['YANG MING', 'YM']
    }
  },
  {
    name: 'SF Express',
    code: 'SF',
    displayName: 'SF Express (順豐)',
    priority: 9,
    identificationPatterns: {
      names: [
        'SF Express',
        '順豐速運',
        '順豐',
        'S.F. Express'
      ],
      keywords: [
        'SF EXPRESS',
        '順豐',
        'SF-EXPRESS.COM',
        'SFEXPRESS'
      ],
      formats: [
        '^SF\\d{12}$'        // SF tracking number
      ],
      logoText: ['SF', '順豐']
    }
  },
  {
    name: 'Kerry Logistics',
    code: 'KERRY',
    displayName: 'Kerry Logistics',
    priority: 6,
    identificationPatterns: {
      names: [
        'Kerry Logistics',
        'Kerry Express',
        '嘉里物流',
        'Kerry EAS'
      ],
      keywords: [
        'KERRY LOGISTICS',
        'KERRY EXPRESS',
        '嘉里',
        'KERRYLOGISTICS.COM'
      ],
      logoText: ['KERRY', '嘉里']
    }
  },
  {
    name: 'Unknown',
    code: 'UNKNOWN',
    displayName: 'Unknown Forwarder',
    priority: 0,
    identificationPatterns: {
      names: [],
      keywords: []
    }
  }
]
```

#### Step 2.2: Update Seed Script

Update `prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import { forwarderSeeds } from './seed-data/forwarders'

const prisma = new PrismaClient()

async function seedForwarders() {
  console.log('Seeding Forwarders...')

  for (const forwarder of forwarderSeeds) {
    await prisma.forwarder.upsert({
      where: { code: forwarder.code },
      update: {
        name: forwarder.name,
        displayName: forwarder.displayName,
        priority: forwarder.priority,
        identificationPatterns: forwarder.identificationPatterns
      },
      create: {
        name: forwarder.name,
        code: forwarder.code,
        displayName: forwarder.displayName,
        priority: forwarder.priority,
        identificationPatterns: forwarder.identificationPatterns
      }
    })
    console.log(`  ✓ ${forwarder.name} (${forwarder.code})`)
  }

  console.log(`Seeded ${forwarderSeeds.length} forwarders`)
}

async function main() {
  // ... existing seed functions ...
  await seedForwarders()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

Run seed:

```bash
npx prisma db seed
```

---

### Phase 3: Python Identification Service (30 min)

#### Step 3.1: Create Mapping Service Structure

```
python-services/
├── mapping/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application
│   ├── identifier.py           # Forwarder identification logic
│   ├── models.py               # Pydantic models
│   ├── config.py               # Configuration
│   └── requirements.txt        # Dependencies
```

#### Step 3.2: Requirements File

Create `python-services/mapping/requirements.txt`:

```text
fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
pydantic-settings==2.1.0
httpx==0.26.0
python-dotenv==1.0.0
structlog==24.1.0
regex==2023.12.25
```

#### Step 3.3: Configuration Module

Create `python-services/mapping/config.py`:

```python
"""
Configuration for Forwarder Mapping Service
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings"""

    service_name: str = "mapping-service"
    service_port: int = 8002

    # Confidence Thresholds
    auto_match_threshold: float = 80.0    # Auto-associate when >= 80%
    review_threshold: float = 50.0         # Queue for review when >= 50%

    # Pattern Matching Weights
    name_match_weight: float = 90.0       # Direct company name match
    keyword_match_weight: float = 70.0    # Keyword match
    format_match_weight: float = 60.0     # Document format match
    logo_text_weight: float = 75.0        # Logo text match

    # Multiple Match Bonus
    multi_match_bonus: float = 5.0        # Bonus per additional match

    log_level: str = "INFO"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
```

#### Step 3.4: Pydantic Models

Create `python-services/mapping/models.py`:

```python
"""
Pydantic models for identification service
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class IdentificationStatus(str, Enum):
    IDENTIFIED = "IDENTIFIED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    UNIDENTIFIED = "UNIDENTIFIED"


class ForwarderPattern(BaseModel):
    """Forwarder identification patterns"""
    names: List[str] = []
    keywords: List[str] = []
    formats: List[str] = []
    logoText: List[str] = Field(default=[], alias="logo_text")


class ForwarderInput(BaseModel):
    """Forwarder data from database"""
    id: str
    name: str
    code: str
    priority: int = 0
    identificationPatterns: ForwarderPattern = Field(alias="identification_patterns")

    class Config:
        populate_by_name = True


class IdentifyRequest(BaseModel):
    """Request for forwarder identification"""
    document_id: str
    extracted_text: str
    forwarders: List[ForwarderInput]

    class Config:
        json_schema_extra = {
            "example": {
                "document_id": "123e4567-e89b-12d3-a456-426614174000",
                "extracted_text": "DHL Express Invoice...",
                "forwarders": []
            }
        }


class MatchDetail(BaseModel):
    """Details of a pattern match"""
    pattern_type: str  # "name", "keyword", "format", "logo_text"
    pattern_value: str
    confidence_contribution: float


class IdentifyResponse(BaseModel):
    """Response from forwarder identification"""
    document_id: str
    forwarder_id: Optional[str] = None
    forwarder_name: Optional[str] = None
    forwarder_code: Optional[str] = None
    confidence: float
    status: IdentificationStatus
    match_method: str  # Primary match type
    matched_patterns: List[str]
    match_details: List[MatchDetail]


class HealthResponse(BaseModel):
    """Health check response"""
    service: str
    status: str
    version: str
```

#### Step 3.5: Identification Logic

Create `python-services/mapping/identifier.py`:

```python
"""
Forwarder identification logic with pattern matching
"""
import re
import structlog
from typing import List, Optional, Tuple
from dataclasses import dataclass

from models import (
    ForwarderInput,
    IdentifyResponse,
    IdentificationStatus,
    MatchDetail
)
from config import get_settings

logger = structlog.get_logger()
settings = get_settings()


@dataclass
class MatchResult:
    """Internal match result"""
    forwarder: ForwarderInput
    confidence: float
    match_method: str
    matched_patterns: List[str]
    match_details: List[MatchDetail]


class ForwarderIdentifier:
    """
    Identifies forwarders from extracted text using pattern matching
    """

    def identify(
        self,
        document_id: str,
        extracted_text: str,
        forwarders: List[ForwarderInput]
    ) -> IdentifyResponse:
        """
        Identify forwarder from extracted text

        Args:
            document_id: Document identifier
            extracted_text: OCR extracted text
            forwarders: List of forwarders with patterns

        Returns:
            IdentifyResponse with best match
        """
        logger.info(
            "Starting forwarder identification",
            document_id=document_id,
            text_length=len(extracted_text),
            forwarder_count=len(forwarders)
        )

        # Normalize text for matching
        text_lower = extracted_text.lower()
        text_upper = extracted_text.upper()

        # Sort forwarders by priority (higher first)
        sorted_forwarders = sorted(
            forwarders,
            key=lambda f: f.priority,
            reverse=True
        )

        # Find all matches
        matches: List[MatchResult] = []

        for forwarder in sorted_forwarders:
            # Skip the "Unknown" placeholder
            if forwarder.code == "UNKNOWN":
                continue

            match_result = self._match_forwarder(
                forwarder,
                text_lower,
                text_upper
            )

            if match_result.confidence > 0:
                matches.append(match_result)

        # Get best match
        if not matches:
            return self._create_no_match_response(document_id)

        # Sort by confidence, then by priority
        matches.sort(
            key=lambda m: (m.confidence, m.forwarder.priority),
            reverse=True
        )

        best_match = matches[0]

        # Determine status based on confidence threshold
        status = self._determine_status(best_match.confidence)

        logger.info(
            "Identification complete",
            document_id=document_id,
            forwarder=best_match.forwarder.code,
            confidence=best_match.confidence,
            status=status.value
        )

        return IdentifyResponse(
            document_id=document_id,
            forwarder_id=best_match.forwarder.id,
            forwarder_name=best_match.forwarder.name,
            forwarder_code=best_match.forwarder.code,
            confidence=best_match.confidence,
            status=status,
            match_method=best_match.match_method,
            matched_patterns=best_match.matched_patterns,
            match_details=best_match.match_details
        )

    def _match_forwarder(
        self,
        forwarder: ForwarderInput,
        text_lower: str,
        text_upper: str
    ) -> MatchResult:
        """Match a single forwarder against text"""
        patterns = forwarder.identificationPatterns
        matched_patterns: List[str] = []
        match_details: List[MatchDetail] = []
        total_confidence = 0.0
        primary_method = ""

        # Check name matches (highest priority)
        for name in patterns.names:
            if name.lower() in text_lower:
                confidence = settings.name_match_weight
                matched_patterns.append(f"name:{name}")
                match_details.append(MatchDetail(
                    pattern_type="name",
                    pattern_value=name,
                    confidence_contribution=confidence
                ))
                if confidence > total_confidence:
                    total_confidence = confidence
                    primary_method = "name"

        # Check logo text matches
        for logo in patterns.logoText:
            if logo.lower() in text_lower or logo.upper() in text_upper:
                confidence = settings.logo_text_weight
                if f"logo:{logo}" not in matched_patterns:
                    matched_patterns.append(f"logo:{logo}")
                    match_details.append(MatchDetail(
                        pattern_type="logo_text",
                        pattern_value=logo,
                        confidence_contribution=confidence
                    ))
                if confidence > total_confidence:
                    total_confidence = confidence
                    primary_method = "logo_text"

        # Check keyword matches
        for keyword in patterns.keywords:
            if keyword.lower() in text_lower:
                confidence = settings.keyword_match_weight
                if f"keyword:{keyword}" not in matched_patterns:
                    matched_patterns.append(f"keyword:{keyword}")
                    match_details.append(MatchDetail(
                        pattern_type="keyword",
                        pattern_value=keyword,
                        confidence_contribution=confidence
                    ))
                if not primary_method:
                    total_confidence = max(total_confidence, confidence)
                    primary_method = "keyword"

        # Check format patterns (regex)
        for format_pattern in patterns.formats:
            try:
                if re.search(format_pattern, text_upper):
                    confidence = settings.format_match_weight
                    matched_patterns.append(f"format:{format_pattern}")
                    match_details.append(MatchDetail(
                        pattern_type="format",
                        pattern_value=format_pattern,
                        confidence_contribution=confidence
                    ))
                    if not primary_method:
                        total_confidence = max(total_confidence, confidence)
                        primary_method = "format"
            except re.error:
                logger.warning(
                    "Invalid regex pattern",
                    forwarder=forwarder.code,
                    pattern=format_pattern
                )

        # Apply multi-match bonus
        if len(matched_patterns) > 1:
            bonus = settings.multi_match_bonus * (len(matched_patterns) - 1)
            total_confidence = min(100.0, total_confidence + bonus)

        return MatchResult(
            forwarder=forwarder,
            confidence=total_confidence,
            match_method=primary_method or "none",
            matched_patterns=matched_patterns,
            match_details=match_details
        )

    def _determine_status(self, confidence: float) -> IdentificationStatus:
        """Determine identification status based on confidence"""
        if confidence >= settings.auto_match_threshold:
            return IdentificationStatus.IDENTIFIED
        elif confidence >= settings.review_threshold:
            return IdentificationStatus.NEEDS_REVIEW
        else:
            return IdentificationStatus.UNIDENTIFIED

    def _create_no_match_response(
        self,
        document_id: str
    ) -> IdentifyResponse:
        """Create response when no match found"""
        return IdentifyResponse(
            document_id=document_id,
            forwarder_id=None,
            forwarder_name=None,
            forwarder_code=None,
            confidence=0.0,
            status=IdentificationStatus.UNIDENTIFIED,
            match_method="none",
            matched_patterns=[],
            match_details=[]
        )


# Singleton instance
_identifier: Optional[ForwarderIdentifier] = None


def get_identifier() -> ForwarderIdentifier:
    """Get or create identifier singleton"""
    global _identifier
    if _identifier is None:
        _identifier = ForwarderIdentifier()
    return _identifier
```

#### Step 3.6: FastAPI Application

Create `python-services/mapping/main.py`:

```python
"""
FastAPI application for Forwarder Mapping Service
"""
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from models import IdentifyRequest, IdentifyResponse, HealthResponse
from identifier import get_identifier

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan"""
    logger.info("Starting Mapping Service", port=settings.service_port)
    yield
    logger.info("Shutting down Mapping Service")


app = FastAPI(
    title="Forwarder Mapping Service",
    description="Identifies forwarders from invoice text using pattern matching",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Service health check"""
    return HealthResponse(
        service=settings.service_name,
        status="healthy",
        version="1.0.0"
    )


@app.post("/identify-forwarder", response_model=IdentifyResponse)
async def identify_forwarder(request: IdentifyRequest):
    """
    Identify forwarder from extracted text

    - **document_id**: Document identifier
    - **extracted_text**: OCR extracted text content
    - **forwarders**: List of forwarders with identification patterns

    Returns the best matching forwarder with confidence score.
    """
    identifier = get_identifier()

    result = identifier.identify(
        document_id=request.document_id,
        extracted_text=request.extracted_text,
        forwarders=request.forwarders
    )

    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.service_port,
        reload=True
    )
```

#### Step 3.7: Docker Configuration

Update `python-services/docker-compose.yml`:

```yaml
version: '3.8'

services:
  extraction-service:
    # ... existing config ...

  mapping-service:
    build:
      context: .
      dockerfile: Dockerfile.mapping
    ports:
      - "8002:8002"
    environment:
      - LOG_LEVEL=INFO
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8002/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Create `python-services/Dockerfile.mapping`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY mapping/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY mapping/ .

RUN adduser --disabled-password --gecos "" appuser
USER appuser

EXPOSE 8002

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
```

---

### Phase 4: Next.js Forwarder Service (25 min)

#### Step 4.1: Type Definitions

Create `src/types/forwarder.ts`:

```typescript
/**
 * Forwarder type definitions
 */

export interface ForwarderPattern {
  names: string[]
  keywords: string[]
  formats?: string[]
  logoText?: string[]
}

export interface Forwarder {
  id: string
  name: string
  code: string
  displayName: string
  priority: number
  identificationPatterns: ForwarderPattern
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export type IdentificationStatus =
  | 'PENDING'
  | 'IDENTIFIED'
  | 'NEEDS_REVIEW'
  | 'UNIDENTIFIED'
  | 'FAILED'

export interface MatchDetail {
  patternType: string
  patternValue: string
  confidenceContribution: number
}

export interface IdentificationResult {
  documentId: string
  forwarderId: string | null
  forwarderName: string | null
  forwarderCode: string | null
  confidence: number
  status: IdentificationStatus
  matchMethod: string
  matchedPatterns: string[]
  matchDetails: MatchDetail[]
}

export interface ForwarderIdentification {
  id: string
  documentId: string
  forwarderId: string | null
  confidence: number
  matchMethod: string
  matchedPatterns: string[]
  isAutoMatched: boolean
  isManual: boolean
  status: IdentificationStatus
  createdAt: Date
}
```

#### Step 4.2: Forwarder Service Layer

Create `src/services/forwarder.service.ts`:

```typescript
/**
 * Forwarder Service
 * Handles forwarder identification and management
 */

import { prisma } from '@/lib/prisma'
import { DocumentStatus, IdentificationStatus } from '@prisma/client'
import type {
  Forwarder,
  IdentificationResult,
  MatchDetail
} from '@/types/forwarder'

const MAPPING_SERVICE_URL = process.env.MAPPING_SERVICE_URL || 'http://localhost:8002'
const AUTO_MATCH_THRESHOLD = 80

/**
 * Get all active forwarders
 */
export async function getAllForwarders(): Promise<Forwarder[]> {
  const forwarders = await prisma.forwarder.findMany({
    where: { isActive: true },
    orderBy: [
      { priority: 'desc' },
      { name: 'asc' }
    ]
  })

  return forwarders as unknown as Forwarder[]
}

/**
 * Get forwarder by ID
 */
export async function getForwarderById(id: string): Promise<Forwarder | null> {
  const forwarder = await prisma.forwarder.findUnique({
    where: { id }
  })

  return forwarder as unknown as Forwarder | null
}

/**
 * Identify forwarder from document OCR text
 */
export async function identifyForwarder(
  documentId: string
): Promise<IdentificationResult> {
  // Get document with OCR result
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      ocrResults: true
    }
  })

  if (!document) {
    throw new Error(`Document not found: ${documentId}`)
  }

  if (!document.ocrResults || document.ocrResults.length === 0) {
    throw new Error('No OCR result available for document')
  }

  const ocrResult = document.ocrResults[0]

  // Get all active forwarders
  const forwarders = await prisma.forwarder.findMany({
    where: { isActive: true },
    orderBy: { priority: 'desc' }
  })

  // Call Python identification service
  const response = await fetch(`${MAPPING_SERVICE_URL}/identify-forwarder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      document_id: documentId,
      extracted_text: ocrResult.extractedText,
      forwarders: forwarders.map(f => ({
        id: f.id,
        name: f.name,
        code: f.code,
        priority: f.priority,
        identification_patterns: f.identificationPatterns
      }))
    })
  })

  if (!response.ok) {
    throw new Error(`Identification service error: ${response.statusText}`)
  }

  const result = await response.json()

  // Transform response
  const identificationResult: IdentificationResult = {
    documentId: result.document_id,
    forwarderId: result.forwarder_id,
    forwarderName: result.forwarder_name,
    forwarderCode: result.forwarder_code,
    confidence: result.confidence,
    status: result.status,
    matchMethod: result.match_method,
    matchedPatterns: result.matched_patterns,
    matchDetails: result.match_details.map((d: Record<string, unknown>) => ({
      patternType: d.pattern_type,
      patternValue: d.pattern_value,
      confidenceContribution: d.confidence_contribution
    }))
  }

  // Save identification result
  await saveIdentificationResult(identificationResult, false)

  // Auto-associate if high confidence
  if (
    identificationResult.confidence >= AUTO_MATCH_THRESHOLD &&
    identificationResult.forwarderId
  ) {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        forwarderId: identificationResult.forwarderId,
        status: DocumentStatus.MAPPING_PROCESSING
      }
    })
  }

  return identificationResult
}

/**
 * Manually assign forwarder to document
 */
export async function manuallyAssignForwarder(
  documentId: string,
  forwarderId: string,
  assignedBy: string
): Promise<void> {
  const forwarder = await prisma.forwarder.findUnique({
    where: { id: forwarderId }
  })

  if (!forwarder) {
    throw new Error('Forwarder not found')
  }

  await prisma.$transaction([
    // Update or create identification record
    prisma.forwarderIdentification.upsert({
      where: { documentId },
      create: {
        documentId,
        forwarderId,
        confidence: 100,
        matchMethod: 'manual',
        matchedPatterns: ['manual_assignment'],
        isAutoMatched: false,
        isManual: true,
        manualAssignedBy: assignedBy,
        manualAssignedAt: new Date(),
        status: 'IDENTIFIED'
      },
      update: {
        forwarderId,
        confidence: 100,
        matchMethod: 'manual',
        matchedPatterns: ['manual_assignment'],
        isAutoMatched: false,
        isManual: true,
        manualAssignedBy: assignedBy,
        manualAssignedAt: new Date(),
        status: 'IDENTIFIED'
      }
    }),
    // Update document
    prisma.document.update({
      where: { id: documentId },
      data: {
        forwarderId,
        status: DocumentStatus.MAPPING_PROCESSING
      }
    })
  ])
}

/**
 * Get documents needing manual forwarder assignment
 */
export async function getUnidentifiedDocuments(limit: number = 50) {
  return prisma.document.findMany({
    where: {
      status: DocumentStatus.OCR_COMPLETED,
      forwarderId: null,
      identifications: {
        some: {
          status: {
            in: ['NEEDS_REVIEW', 'UNIDENTIFIED']
          }
        }
      }
    },
    include: {
      identifications: {
        orderBy: { createdAt: 'desc' },
        take: 1
      },
      uploader: {
        select: { name: true }
      }
    },
    orderBy: { createdAt: 'asc' },
    take: limit
  })
}

/**
 * Save identification result to database
 */
async function saveIdentificationResult(
  result: IdentificationResult,
  isManual: boolean
): Promise<void> {
  await prisma.forwarderIdentification.upsert({
    where: { documentId: result.documentId },
    create: {
      documentId: result.documentId,
      forwarderId: result.forwarderId,
      confidence: result.confidence,
      matchMethod: result.matchMethod,
      matchedPatterns: result.matchedPatterns,
      matchDetails: result.matchDetails,
      isAutoMatched: !isManual,
      isManual,
      status: result.status as IdentificationStatus
    },
    update: {
      forwarderId: result.forwarderId,
      confidence: result.confidence,
      matchMethod: result.matchMethod,
      matchedPatterns: result.matchedPatterns,
      matchDetails: result.matchDetails,
      status: result.status as IdentificationStatus
    }
  })
}
```

#### Step 4.3: Identify Forwarder API

Create `src/app/api/forwarders/identify/route.ts`:

```typescript
/**
 * POST /api/forwarders/identify
 * Identify forwarder for a document
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { identifyForwarder } from '@/services/forwarder.service'
import { z } from 'zod'

const requestSchema = z.object({
  documentId: z.string().uuid()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validation = requestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const result = await identifyForwarder(validation.data.documentId)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Identify forwarder error:', error)

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        )
      }
      if (error.message.includes('No OCR result')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### Step 4.4: Manual Assignment API

Create `src/app/api/forwarders/assign/route.ts`:

```typescript
/**
 * POST /api/forwarders/assign
 * Manually assign forwarder to a document
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { manuallyAssignForwarder } from '@/services/forwarder.service'
import { z } from 'zod'

const requestSchema = z.object({
  documentId: z.string().uuid(),
  forwarderId: z.string().uuid()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validation = requestSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    await manuallyAssignForwarder(
      validation.data.documentId,
      validation.data.forwarderId,
      session.user.id
    )

    return NextResponse.json({
      success: true,
      message: 'Forwarder assigned successfully'
    })

  } catch (error) {
    console.error('Manual assign error:', error)

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### Step 4.5: List Forwarders API

Create `src/app/api/forwarders/route.ts`:

```typescript
/**
 * GET /api/forwarders
 * List all active forwarders
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAllForwarders } from '@/services/forwarder.service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const forwarders = await getAllForwarders()

    return NextResponse.json({
      success: true,
      data: forwarders
    })

  } catch (error) {
    console.error('List forwarders error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

#### Step 4.6: Unidentified Documents API

Create `src/app/api/forwarders/unidentified/route.ts`:

```typescript
/**
 * GET /api/forwarders/unidentified
 * Get documents needing manual forwarder assignment
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUnidentifiedDocuments } from '@/services/forwarder.service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    const documents = await getUnidentifiedDocuments(limit)

    return NextResponse.json({
      success: true,
      data: documents,
      count: documents.length
    })

  } catch (error) {
    console.error('Unidentified documents error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

### Phase 5: Environment Configuration (5 min)

Add to `.env.example`:

```bash
# ===========================================
# Python Mapping Service
# ===========================================
MAPPING_SERVICE_URL="http://localhost:8002"
```

---

## Testing Guide

### Unit Tests

Create `python-services/mapping/tests/test_identifier.py`:

```python
import pytest
from identifier import ForwarderIdentifier
from models import ForwarderInput, ForwarderPattern

@pytest.fixture
def identifier():
    return ForwarderIdentifier()

@pytest.fixture
def sample_forwarders():
    return [
        ForwarderInput(
            id="1",
            name="DHL Express",
            code="DHL",
            priority=10,
            identification_patterns=ForwarderPattern(
                names=["DHL Express", "DHL International"],
                keywords=["DHL WAYBILL", "EXPRESS WORLDWIDE"],
                formats=[],
                logo_text=["DHL"]
            )
        ),
        ForwarderInput(
            id="2",
            name="FedEx",
            code="FDX",
            priority=10,
            identification_patterns=ForwarderPattern(
                names=["FedEx", "Federal Express"],
                keywords=["FEDEX", "TRACKING NUMBER"],
                formats=[],
                logo_text=["FedEx"]
            )
        )
    ]

def test_identify_dhl(identifier, sample_forwarders):
    """Test DHL identification"""
    result = identifier.identify(
        document_id="test-1",
        extracted_text="DHL Express Invoice\nWAYBILL: 1234567890",
        forwarders=sample_forwarders
    )

    assert result.forwarder_code == "DHL"
    assert result.confidence >= 80
    assert result.status.value == "IDENTIFIED"

def test_identify_low_confidence(identifier, sample_forwarders):
    """Test low confidence result"""
    result = identifier.identify(
        document_id="test-2",
        extracted_text="Some generic invoice with tracking",
        forwarders=sample_forwarders
    )

    assert result.confidence < 80

def test_no_match(identifier, sample_forwarders):
    """Test no match scenario"""
    result = identifier.identify(
        document_id="test-3",
        extracted_text="Random document with no forwarder info",
        forwarders=sample_forwarders
    )

    assert result.forwarder_id is None
    assert result.status.value == "UNIDENTIFIED"
```

### Integration Tests

```bash
# Start mapping service
cd python-services
docker-compose up -d mapping-service

# Test health
curl http://localhost:8002/health

# Test identification
curl -X POST http://localhost:8002/identify-forwarder \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "test-123",
    "extracted_text": "DHL Express International Waybill",
    "forwarders": [
      {
        "id": "1",
        "name": "DHL Express",
        "code": "DHL",
        "priority": 10,
        "identification_patterns": {
          "names": ["DHL Express"],
          "keywords": ["DHL", "WAYBILL"],
          "formats": [],
          "logo_text": ["DHL"]
        }
      }
    ]
  }'
```

---

## Verification Checklist

| Item | Expected Result | Status |
|------|-----------------|--------|
| Prisma migration runs | Forwarder tables created | [ ] |
| Seed data created | 14 forwarders in DB | [ ] |
| Python service starts | Health check 200 | [ ] |
| DHL identification | Code: DHL, Confidence >= 90 | [ ] |
| FedEx identification | Code: FDX, Confidence >= 90 | [ ] |
| High confidence auto-links | Document.forwarderId set | [ ] |
| Low confidence queued | status = NEEDS_REVIEW | [ ] |
| Manual assignment works | Forwarder linked, status updated | [ ] |
| Unidentified list | Documents returned correctly | [ ] |

---

## Confidence Scoring Reference

| Match Type | Base Score | Notes |
|------------|------------|-------|
| Name match | 90 | Exact company name found |
| Logo text | 75 | Logo-associated text found |
| Keyword match | 70 | Specific keyword found |
| Format match | 60 | Tracking number format matched |
| Multi-match bonus | +5 per additional | Caps at 100 |

---

## Related Documentation

- [Story 2.3 User Story](./stories/2-3-forwarder-auto-identification.md)
- [Story 2.2 Tech Spec](./tech-spec-story-2-2.md) (Prerequisite)
- [Forwarder Seed Data](../prisma/seed-data/forwarders.ts)

---

*Tech Spec Version: 1.0*
*Last Updated: 2025-12-16*
