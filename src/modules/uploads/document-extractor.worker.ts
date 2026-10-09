import { parentPort, workerData } from 'worker_threads';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

type ExtractionResult = {
  pages?: number;
  extractedText?: string;
  status: 'completed' | 'failed' | 'not-applicable';
};

function capText(text: string, cap: number): string | undefined {
  if (!text) return undefined;
  // Compress whitespace but preserve form-feeds (\f) which mark page boundaries
  const trimmed = text.replace(/[^\S\f]+/g, ' ').trim();
  return trimmed.length > cap ? trimmed.slice(0, cap) : trimmed;
}

async function extract(): Promise<ExtractionResult> {
  const buffer = Buffer.from(workerData.buffer as ArrayBuffer);
  const fileType = String(workerData.fileType);
  const textCap = Number(workerData.textCap);

  try {
    if (fileType === 'pdf') {
      const parsed = await pdfParse(buffer, {
        pagerender: async function (pageData: any) {
          const textContent = await pageData.getTextContent();
          const text = textContent.items.map((item: any) => item.str).join(' ');
          return text + '\f';
        },
      });
      return {
        pages: parsed.numpages,
        extractedText: capText(parsed.text, textCap),
        status: 'completed',
      };
    }
    if (fileType === 'doc' || fileType === 'docx') {
      const { value } = await mammoth.extractRawText({ buffer });
      return {
        extractedText: capText(value, textCap),
        status: 'completed',
      };
    }
  } catch {
    return { status: 'failed' };
  }
  return { status: 'not-applicable' };
}

extract()
  .then((result) => parentPort?.postMessage(result))
  .catch(() => parentPort?.postMessage({ status: 'failed' }));
