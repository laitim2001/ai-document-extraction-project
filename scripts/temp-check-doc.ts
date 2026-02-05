import { prisma } from '../src/lib/prisma';

async function main() {
  const doc = await prisma.document.findFirst({
    where: { id: '65e94d29-a419-47d2-91c6-90b7500e887a' },
    include: {
      extractionResult: true,
    }
  });
  console.log('=== Document Record ===');
  console.log('processingPath:', doc?.processingPath);
  console.log('routingDecision:', doc?.routingDecision);
  console.log('extractionVersion:', doc?.extractionVersion);
  console.log('');
  console.log('=== Extraction Result ===');
  if (doc?.extractionResult) {
    console.log('confidence:', doc.extractionResult.confidence);
  }
  console.log('');
  console.log('=== Stage 1 AI Details ===');
  console.log(JSON.stringify(doc?.stage1AiDetails, null, 2));
  console.log('');
  console.log('=== Stage 2 AI Details ===');
  console.log(JSON.stringify(doc?.stage2AiDetails, null, 2));
  console.log('');
  console.log('=== Stage 3 AI Details ===');
  console.log(JSON.stringify(doc?.stage3AiDetails, null, 2));
  console.log('');
  console.log('=== AI Details (legacy) ===');
  const aiDetails = doc?.aiDetails as any;
  if (aiDetails) {
    console.log('prompt exists:', !!aiDetails.prompt);
    console.log('gptResponse exists:', !!aiDetails.gptResponse);
    console.log('Keys:', Object.keys(aiDetails));
  } else {
    console.log('aiDetails is null');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
