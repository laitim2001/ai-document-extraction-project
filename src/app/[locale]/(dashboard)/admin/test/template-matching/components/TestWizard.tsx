/**
 * @fileoverview 測試向導框架組件
 * @description
 *   提供步驟指示器和導航按鈕
 *
 * @module src/app/[locale]/(dashboard)/admin/test/template-matching/components
 * @since Epic 19 - Story 19.8
 * @lastModified 2026-01-23
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { TestStep } from '../types';

interface TestWizardProps {
  steps: Array<{ id: TestStep; title: string }>;
  currentStep: TestStep;
  completedSteps: TestStep[];
  onGoToStep: (step: TestStep) => void;
  onNext: () => void;
  onPrevious: () => void;
  canProceed: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
  children: React.ReactNode;
}

/**
 * 測試向導框架組件
 */
export function TestWizard({
  steps,
  currentStep,
  completedSteps,
  onGoToStep,
  onNext,
  onPrevious,
  canProceed,
  isFirstStep,
  isLastStep,
  children,
}: TestWizardProps) {
  const t = useTranslations('templateMatchingTest.wizard');

  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="space-y-6">
      {/* 步驟指示器 */}
      <div className="flex items-center justify-between">
        <nav aria-label="Progress" className="flex-1">
          <ol className="flex items-center">
            {steps.map((step, index) => {
              const isCompleted = completedSteps.includes(step.id);
              const isCurrent = step.id === currentStep;
              const isPast = index < currentIndex;

              return (
                <li
                  key={step.id}
                  className={cn(
                    'relative flex-1',
                    index !== steps.length - 1 && 'pr-8 sm:pr-20'
                  )}
                >
                  {/* 連接線 */}
                  {index !== steps.length - 1 && (
                    <div
                      className="absolute inset-0 flex items-center"
                      aria-hidden="true"
                    >
                      <div
                        className={cn(
                          'h-0.5 w-full',
                          isPast || isCompleted
                            ? 'bg-primary'
                            : 'bg-muted'
                        )}
                      />
                    </div>
                  )}

                  {/* 步驟圖標 */}
                  <button
                    onClick={() => onGoToStep(step.id)}
                    disabled={index > currentIndex && !isCompleted}
                    className={cn(
                      'relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                      isCompleted
                        ? 'bg-primary text-primary-foreground'
                        : isCurrent
                        ? 'border-2 border-primary bg-background text-primary'
                        : 'border-2 border-muted bg-background text-muted-foreground',
                      (index <= currentIndex || isCompleted) &&
                        'cursor-pointer hover:bg-primary/90 hover:text-primary-foreground'
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </button>

                  {/* 步驟標題 */}
                  <span
                    className={cn(
                      'absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs',
                      isCurrent
                        ? 'text-foreground font-medium'
                        : 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* 進度文字 */}
        <div className="text-sm text-muted-foreground">
          {t('progress.step', {
            current: currentIndex + 1,
            total: steps.length,
          })}
        </div>
      </div>

      {/* 步驟內容 */}
      <Card className="mt-12">
        <CardContent className="pt-6">{children}</CardContent>
      </Card>

      {/* 導航按鈕 */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={onPrevious}
          disabled={isFirstStep}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          {t('navigation.previous')}
        </Button>

        <Button onClick={onNext} disabled={!canProceed || isLastStep}>
          {isLastStep ? t('navigation.finish') : t('navigation.next')}
          {!isLastStep && <ChevronRight className="h-4 w-4 ml-2" />}
        </Button>
      </div>
    </div>
  );
}
