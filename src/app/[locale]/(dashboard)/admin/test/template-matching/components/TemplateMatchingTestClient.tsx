/**
 * @fileoverview 模版匹配整合測試客戶端組件
 * @description
 *   管理測試向導狀態和步驟導航
 *
 * @module src/app/[locale]/(dashboard)/admin/test/template-matching/components
 * @since Epic 19 - Story 19.8
 * @lastModified 2026-01-23
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { TestWizard } from './TestWizard';
import { TestDataSelector } from './TestDataSelector';
import { TemplateSelector } from './TemplateSelector';
import { MappingPreview } from './MappingPreview';
import { MatchExecutor } from './MatchExecutor';
import { ResultViewer } from './ResultViewer';
import { ExportTester } from './ExportTester';
import { TestReportGenerator } from './TestReportGenerator';
import type { TestState, TestStep, StepResult } from '../types';

/**
 * 模版匹配整合測試客戶端組件
 */
export function TemplateMatchingTestClient() {
  const t = useTranslations('templateMatchingTest');

  // 測試狀態
  const [currentStep, setCurrentStep] = React.useState<TestStep>('select-data');
  const [testState, setTestState] = React.useState<TestState>({
    selectedDocuments: [],
    mockData: null,
    dataSource: 'mock',
    selectedTemplate: null,
    resolvedMappings: null,
    instanceId: null,
    matchResult: null,
    exportResult: null,
    stepResults: {},
  });

  // 步驟定義
  const steps: Array<{
    id: TestStep;
    title: string;
  }> = [
    { id: 'select-data', title: t('wizard.steps.selectData') },
    { id: 'select-template', title: t('wizard.steps.selectTemplate') },
    { id: 'review-mapping', title: t('wizard.steps.reviewMapping') },
    { id: 'execute-match', title: t('wizard.steps.executeMatch') },
    { id: 'view-results', title: t('wizard.steps.viewResults') },
    { id: 'test-export', title: t('wizard.steps.testExport') },
  ];

  // 更新測試狀態
  const updateTestState = React.useCallback((updates: Partial<TestState>) => {
    setTestState((prev) => ({ ...prev, ...updates }));
  }, []);

  // 記錄步驟結果
  const recordStepResult = React.useCallback(
    (step: TestStep, result: StepResult) => {
      setTestState((prev) => ({
        ...prev,
        stepResults: {
          ...prev.stepResults,
          [step]: result,
        },
      }));
    },
    []
  );

  // 獲取當前步驟索引
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  // 檢查是否可以進入下一步
  const canProceed = React.useMemo(() => {
    switch (currentStep) {
      case 'select-data':
        return (
          testState.selectedDocuments.length > 0 || testState.mockData !== null
        );
      case 'select-template':
        return testState.selectedTemplate !== null;
      case 'review-mapping':
        return testState.resolvedMappings !== null;
      case 'execute-match':
        return testState.matchResult !== null;
      case 'view-results':
        return testState.matchResult !== null;
      case 'test-export':
        return true;
      default:
        return false;
    }
  }, [currentStep, testState]);

  // 下一步
  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].id);
    }
  };

  // 上一步
  const handlePrevious = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].id);
    }
  };

  // 跳轉到指定步驟
  const handleGoToStep = (step: TestStep) => {
    const targetIndex = steps.findIndex((s) => s.id === step);
    // 只能跳轉到已完成的步驟或當前步驟
    if (targetIndex <= currentStepIndex) {
      setCurrentStep(step);
    }
  };

  // 渲染當前步驟內容
  const renderStepContent = () => {
    switch (currentStep) {
      case 'select-data':
        return (
          <TestDataSelector
            testState={testState}
            onUpdate={updateTestState}
            onRecordResult={(result) => recordStepResult('select-data', result)}
          />
        );
      case 'select-template':
        return (
          <TemplateSelector
            testState={testState}
            onUpdate={updateTestState}
            onRecordResult={(result) =>
              recordStepResult('select-template', result)
            }
          />
        );
      case 'review-mapping':
        return (
          <MappingPreview
            testState={testState}
            onUpdate={updateTestState}
            onRecordResult={(result) =>
              recordStepResult('review-mapping', result)
            }
          />
        );
      case 'execute-match':
        return (
          <MatchExecutor
            testState={testState}
            onUpdate={updateTestState}
            onRecordResult={(result) =>
              recordStepResult('execute-match', result)
            }
          />
        );
      case 'view-results':
        return (
          <ResultViewer
            testState={testState}
            onUpdate={updateTestState}
            onRecordResult={(result) => recordStepResult('view-results', result)}
          />
        );
      case 'test-export':
        return (
          <ExportTester
            testState={testState}
            onUpdate={updateTestState}
            onRecordResult={(result) => recordStepResult('test-export', result)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <TestWizard
        steps={steps}
        currentStep={currentStep}
        completedSteps={Object.keys(testState.stepResults) as TestStep[]}
        onGoToStep={handleGoToStep}
        onNext={handleNext}
        onPrevious={handlePrevious}
        canProceed={canProceed}
        isFirstStep={currentStepIndex === 0}
        isLastStep={currentStepIndex === steps.length - 1}
      >
        {renderStepContent()}
      </TestWizard>

      {/* 測試報告生成器 */}
      {currentStepIndex === steps.length - 1 && (
        <TestReportGenerator testState={testState} steps={steps} />
      )}
    </div>
  );
}
