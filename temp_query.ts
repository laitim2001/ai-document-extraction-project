import { prisma } from './src/lib/prisma';

async function main() {
  const doc = await prisma.document.findUnique({
    where: { id: 'd06a4bc2-31b4-4e7c-b8b5-2757051c6c38' },
    include: {
      extractionResult: true,
      company: { select: { name: true } },
    }
  });

  if (!doc) {
    console.log('Document not found');
    return;
  }

  console.log('=== Document Info ===');
  console.log('File:', doc.fileName);
  console.log('Status:', doc.status);
  console.log('Error:', doc.errorMessage);
  console.log('Company:', doc.company?.name || 'N/A');
  console.log('Processing Path:', doc.processingPath);

  if (doc.extractionResult) {
    console.log('\n=== Extraction Result ===');
    console.log('Status:', doc.extractionResult.status);
    console.log('Version:', doc.extractionResult.extractionVersion);
    console.log('Confidence:', doc.extractionResult.averageConfidence);

    // Check pipeline steps for errors
    if (doc.extractionResult.pipelineSteps) {
      const steps = doc.extractionResult.pipelineSteps as any[];
      console.log('\n=== Pipeline Steps ===');
      steps.forEach((s: any) => {
        const status = s.skipped ? 'SKIPPED' : (s.success ? 'OK' : 'FAILED');
        console.log(`  ${s.step}: ${status} ${s.error ? '- ' + s.error : ''}`);
      });
    }

    // Check stage results for errors
    if (doc.extractionResult.stage1Result) {
      const s1 = doc.extractionResult.stage1Result as any;
      console.log('\n=== Stage 1 Result ===');
      console.log('Success:', s1.success);
      console.log('Company:', s1.companyName);
      console.log('Confidence:', s1.confidence);
      if (s1.error) console.log('Error:', s1.error);
      if (s1.isNewCompany) console.log('*** NEW COMPANY ***');
    }

    if (doc.extractionResult.stage2Result) {
      const s2 = doc.extractionResult.stage2Result as any;
      console.log('\n=== Stage 2 Result ===');
      console.log('Success:', s2.success);
      console.log('Format:', s2.formatName);
      console.log('Config Source:', s2.configSource);
      if (s2.error) console.log('Error:', s2.error);
      if (s2.isNewFormat) console.log('*** NEW FORMAT ***');
    }

    if (doc.extractionResult.stage3Result) {
      const s3 = doc.extractionResult.stage3Result as any;
      console.log('\n=== Stage 3 Result ===');
      console.log('Success:', s3.success);
      console.log('Overall Confidence:', s3.overallConfidence);
      if (s3.error) console.log('Error:', s3.error);
    }
  }
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); process.exit(1); });
