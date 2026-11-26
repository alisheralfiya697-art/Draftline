import path from 'node:path';
import mammoth from 'mammoth';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_EXTENSIONS = new Set(['.txt', '.md', '.docx']);

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'br',
    'h1',
    'h2',
    'h3',
    'h4',
    'strong',
    'b',
    'em',
    'i',
    'u',
    's',
    'ul',
    'ol',
    'li',
    'blockquote',
    'pre',
    'code',
    'hr',
  ],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

export function sanitizeDocumentHtml(rawHtml: string): string {
  const cleaned = sanitizeHtml(rawHtml ?? '', SANITIZE_OPTIONS).trim();
  return cleaned.length > 0 ? cleaned : '<p></p>';
}

export function stripHtmlToText(html: string): string {
  const spaced = (html ?? '').replace(
    /<\/?(p|h[1-6]|li|blockquote|div|br)\b[^>]*>/gi,
    ' '
  );
  return sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
}

export function countWords(html: string): number {
  const plain = stripHtmlToText(html);
  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}

function escapeHtmlText(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function plainTextToHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return '<p></p>';
  }
  const paragraphs = normalized.split(/\n{2,}/);
  return paragraphs
    .map((para) => {
      const lines = para.split('\n').map((line) => escapeHtmlText(line));
      return `<p>${lines.join('<br>')}</p>`;
    })
    .join('');
}

export function deriveTitleFromFilename(filename: string): string {
  const base = path.basename(filename, path.extname(filename)).trim();
  const normalized = base.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'Imported Document';
  }
  return normalized.slice(0, 160);
}

export class ImportValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ImportValidationError';
    this.status = status;
  }
}

export async function parseImportedFile(params: {
  originalName: string;
  buffer: Buffer;
}): Promise<{
  title: string;
  contentHtml: string;
  sourceFormat: 'txt' | 'md' | 'docx';
}> {
  const { originalName, buffer } = params;
  const ext = path.extname(originalName || '').toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ImportValidationError(
      `Unsupported file format "${ext || 'unknown'}". Please upload a .txt, .md, or .docx file.`
    );
  }

  if (!buffer || buffer.length === 0) {
    throw new ImportValidationError('The uploaded file is empty.');
  }

  if (buffer.length > MAX_IMPORT_BYTES) {
    throw new ImportValidationError('File exceeds the 5 MB upload limit.');
  }

  const title = deriveTitleFromFilename(originalName);

  if (ext === '.txt') {
    const text = buffer.toString('utf8');
    if (!text.trim()) {
      throw new ImportValidationError('The uploaded .txt file contains no text.');
    }
    return {
      title,
      contentHtml: sanitizeDocumentHtml(plainTextToHtml(text)),
      sourceFormat: 'txt',
    };
  }

  if (ext === '.md') {
    const markdown = buffer.toString('utf8');
    if (!markdown.trim()) {
      throw new ImportValidationError('The uploaded .md file contains no text.');
    }
    const rendered = await marked.parse(markdown, { async: true, gfm: true, breaks: false });
    return {
      title,
      contentHtml: sanitizeDocumentHtml(rendered),
      sourceFormat: 'md',
    };
  }

  // .docx via mammoth
  try {
    const result = await mammoth.convertToHtml({ buffer });
    const sanitized = sanitizeDocumentHtml(result.value);
    if (!stripHtmlToText(sanitized)) {
      throw new ImportValidationError('The uploaded .docx file appears to have no readable text.');
    }
    return {
      title,
      contentHtml: sanitized,
      sourceFormat: 'docx',
    };
  } catch (err) {
    if (err instanceof ImportValidationError) {
      throw err;
    }
    throw new ImportValidationError(
      'Could not parse .docx file. Please verify it is a valid Word (.docx) document.'
    );
  }
}
