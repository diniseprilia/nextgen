import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'ppt', 'pptx',
]);

export const UNSUPPORTED_FILE_ERROR = 'File format is not supported.';

const MIME_BY_EXT = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

let pdfParseFn = null;
let mammothModule = null;

function getPdfParse() {
  if (!pdfParseFn) pdfParseFn = require('pdf-parse');
  return pdfParseFn;
}

async function getMammoth() {
  if (!mammothModule) mammothModule = await import('mammoth');
  return mammothModule;
}

export function getExtension(filename) {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

export function isAllowedFile(filename) {
  return ALLOWED_EXTENSIONS.has(getExtension(filename));
}

export function guessMimeType(filename) {
  const ext = getExtension(filename);
  return MIME_BY_EXT[ext] || 'application/octet-stream';
}

export async function extractTextContent(buffer, extension) {
  if (extension === 'pdf') {
    try {
      const pdfParse = getPdfParse();
      const data = await pdfParse(buffer);
      return data.text?.trim() || null;
    } catch {
      return null;
    }
  }

  if (extension === 'docx' || extension === 'doc') {
    try {
      const mammoth = await getMammoth();
      const { value } = await mammoth.extractRawText({ buffer });
      return value?.trim() || null;
    } catch {
      return null;
    }
  }

  if (extension === 'ppt' || extension === 'pptx') {
    try {
      const { default: OfficeParser } = await import('officeparser');
      const ast = await OfficeParser.parseOffice(buffer);
      return ast.toText?.()?.trim() || null;
    } catch {
      return null;
    }
  }

  return null;
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
