import { createRequire } from 'module';
import mammoth from 'mammoth';
import type { AttachmentResult } from './types.ts';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse/lib/pdf-parse.js') as typeof import('pdf-parse');

const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/tab-separated-values',
  'text/html',
  'application/json',
  'application/xml',
  'text/xml',
]);

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.csv', '.tsv', '.json', '.xml', '.html', '.htm', '.log',
  '.yaml', '.yml', '.js', '.ts', '.py', '.sql', '.ini', '.conf', '.cfg',
]);

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot < 0 ? '' : filename.slice(dot).toLowerCase();
}

export function canParseAttachment(filename: string, mimeType: string): boolean {
  const extension = extensionOf(filename);
  const mime = mimeType.toLowerCase().split(';')[0].trim();
  return (
    TEXT_MIME_TYPES.has(mime) ||
    TEXT_EXTENSIONS.has(extension) ||
    mime === 'application/pdf' ||
    extension === '.pdf' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === '.docx'
  );
}

export async function parseAttachment(
  filename: string,
  mimeType: string,
  buffer: Buffer,
): Promise<AttachmentResult> {
  const extension = extensionOf(filename);
  const mime = mimeType.toLowerCase().split(';')[0].trim();
  const base = { filename, mimeType, size: buffer.length, isConvertible: true };

  try {
    if (mime === 'application/pdf' || extension === '.pdf') {
      const parsed = await pdfParse(buffer);
      return { ...base, textContent: parsed.text.trim() };
    }

    if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      extension === '.docx'
    ) {
      const parsed = await mammoth.extractRawText({ buffer });
      return { ...base, textContent: parsed.value.trim() };
    }

    const rawText = buffer.toString('utf8');
    const textContent = mime === 'text/html' || extension === '.html' || extension === '.htm'
      ? rawText
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : rawText.trim();

    return { ...base, textContent };
  } catch (error) {
    return {
      ...base,
      textContent: '',
      error: error instanceof Error ? error.message : 'Unable to parse attachment',
    };
  }
}
