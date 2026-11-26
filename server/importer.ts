import path from 'node:path';
import mammoth from 'mammoth';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_EXTENSIONS = new Set(['.txt', '.md', '.docx']);

const DISALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/'];

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

function decodeStrictUtf8Text(buffer: Buffer, ext: string): string {
  if (buffer.includes(0x00)) {
    throw new ImportValidationError(
      `The uploaded ${ext} file appears to be binary rather than plain text.`
    );
  }

  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new ImportValidationError(
      `The uploaded ${ext} file is not valid UTF-8 text.`
    );
  }

  // Reject binary control characters outside standard whitespace (\t, \n, \r)
  for (let i = 0; i < decoded.length; i += 1) {
    const code = decoded.charCodeAt(i);
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      throw new ImportValidationError(
        `The uploaded ${ext} file contains unsupported binary control characters.`
      );
    }
  }

  return decoded.replace(/^\uFEFF/, '');
}

function hasZipMagicHeader(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 && // P
    buffer[1] === 0x4b && // K
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
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
  mimeType?: string;
}): Promise<{
  title: string;
  contentHtml: string;
  sourceFormat: 'txt' | 'md' | 'docx';
}> {
  const { originalName, buffer, mimeType } = params;
  const ext = path.extname(originalName || '').toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ImportValidationError(
      `Unsupported file format "${ext || 'unknown'}". Please upload a .txt, .md, or .docx file.`
    );
  }

  if (
    mimeType &&
    DISALLOWED_MIME_PREFIXES.some((prefix) =>
      mimeType.toLowerCase().startsWith(prefix)
    )
  ) {
    throw new ImportValidationError(
      'Unsupported media file type. Please upload a .txt, .md, or .docx document.'
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
    const text = decodeStrictUtf8Text(buffer, '.txt');
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
    const markdown = decodeStrictUtf8Text(buffer, '.md');
    if (!markdown.trim()) {
      throw new ImportValidationError('The uploaded .md file contains no text.');
    }
    const rendered = await marked.parse(markdown, {
      async: true,
      gfm: true,
      breaks: false,
    });
    return {
      title,
      contentHtml: sanitizeDocumentHtml(rendered),
      sourceFormat: 'md',
    };
  }

  // .docx must start with ZIP signature (PK\x03\x04) before passing to mammoth
  if (!hasZipMagicHeader(buffer)) {
    throw new ImportValidationError(
      'Invalid .docx file signature. Please upload a genuine Word (.docx) document.'
    );
  }

  try {
    const result = await mammoth.convertToHtml({ buffer });
    const sanitized = sanitizeDocumentHtml(result.value);
    if (!stripHtmlToText(sanitized)) {
      throw new ImportValidationError(
        'The uploaded .docx file appears to have no readable text.'
      );
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
