'use client';

/**
 * @fileoverview Language Tabs Component for SDK Examples
 * @description
 *   Tab component for switching between different programming language examples.
 *   Displays TypeScript, Python, and C# code samples.
 *
 * @module src/components/features/docs/LanguageTabs
 * @since Epic 11 - Story 11.6
 * @lastModified 2024-12-21
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { CodeBlock } from './CodeBlock';
import type { SDKLanguage } from '@/types/sdk-examples';

// ============================================================
// Types
// ============================================================

interface LanguageTabsProps {
  code: Record<SDKLanguage, string>;
  defaultLanguage?: SDKLanguage;
  className?: string;
}

// ============================================================
// Constants
// ============================================================

const LANGUAGES: Array<{ id: SDKLanguage; name: string; icon: string }> = [
  { id: 'typescript', name: 'TypeScript', icon: 'TS' },
  { id: 'python', name: 'Python', icon: 'PY' },
  { id: 'csharp', name: 'C#', icon: 'C#' },
];

// ============================================================
// Component
// ============================================================

/**
 * LanguageTabs Component
 * Displays code examples with tabs for different languages
 */
export function LanguageTabs({
  code,
  defaultLanguage = 'typescript',
  className,
}: LanguageTabsProps) {
  const [activeLanguage, setActiveLanguage] = React.useState<SDKLanguage>(defaultLanguage);

  return (
    <div className={cn('rounded-lg border bg-card', className)}>
      {/* Tab Headers */}
      <div className="flex border-b">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.id}
            onClick={() => setActiveLanguage(lang.id)}
            className={cn(
              'flex items-center space-x-2 px-4 py-2 text-sm font-medium transition-colors',
              'border-b-2 -mb-px',
              activeLanguage === lang.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
            )}
          >
            <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
              {lang.icon}
            </span>
            <span>{lang.name}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-0">
        <CodeBlock
          code={code[activeLanguage] || '// No code available'}
          language={activeLanguage}
          showLineNumbers={true}
          copyable={true}
        />
      </div>
    </div>
  );
}
