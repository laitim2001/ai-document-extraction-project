'use client';

/**
 * @fileoverview Code Block Component with Syntax Highlighting
 * @description
 *   Renders code snippets with syntax highlighting and copy functionality.
 *   Supports multiple programming languages.
 *
 * @module src/components/features/docs/CodeBlock
 * @since Epic 11 - Story 11.6
 * @lastModified 2024-12-21
 */

import * as React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

interface CodeBlockProps {
  code: string;
  language: string;
  title?: string;
  showLineNumbers?: boolean;
  copyable?: boolean;
  className?: string;
}

// ============================================================
// Component
// ============================================================

/**
 * CodeBlock Component
 * Renders syntax-highlighted code with optional copy functionality
 */
export function CodeBlock({
  code,
  language,
  title,
  showLineNumbers = true,
  copyable = true,
  className,
}: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Map language names to Prism language identifiers
  const prismLanguage = React.useMemo(() => {
    const languageMap: Record<string, string> = {
      typescript: 'typescript',
      ts: 'typescript',
      javascript: 'javascript',
      js: 'javascript',
      python: 'python',
      py: 'python',
      csharp: 'csharp',
      cs: 'csharp',
      bash: 'bash',
      sh: 'bash',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
    };
    return languageMap[language.toLowerCase()] || language;
  }, [language]);

  return (
    <div className={cn('relative rounded-lg overflow-hidden', className)}>
      {/* Header */}
      {(title || copyable) && (
        <div className="flex items-center justify-between bg-zinc-800 px-4 py-2 text-sm">
          {title && <span className="text-zinc-400 font-medium">{title}</span>}
          {copyable && (
            <button
              onClick={handleCopy}
              className="ml-auto text-zinc-400 hover:text-zinc-200 transition-colors"
              aria-label={copied ? 'Copied!' : 'Copy code'}
            >
              {copied ? (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-green-400"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                  <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                </svg>
              )}
            </button>
          )}
        </div>
      )}

      {/* Code */}
      <SyntaxHighlighter
        language={prismLanguage}
        style={vscDarkPlus}
        showLineNumbers={showLineNumbers}
        customStyle={{
          margin: 0,
          borderRadius: title || copyable ? '0 0 0.5rem 0.5rem' : '0.5rem',
          fontSize: '0.875rem',
        }}
        lineNumberStyle={{
          minWidth: '3em',
          paddingRight: '1em',
          color: '#6b7280',
          userSelect: 'none',
        }}
      >
        {code.trim()}
      </SyntaxHighlighter>
    </div>
  );
}
