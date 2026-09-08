import { inflateRawSync } from 'node:zlib';

import * as CFB from 'cfb';
import { load } from 'cheerio';
import { unzipSync } from 'fflate';
import * as XLSX from 'xlsx';

import { decodeDocument, ImportError, MAX_FILE_BYTES } from './schoolinfo';

export type ParsedDocument = {
  format: string;
  text: string | null;
  warnings: string[];
};
const MAX_EXPANDED = 32 * 1024 * 1024;
const MAX_TEXT = 240_000;

function boundedText(
  format: string,
  value: unknown,
  warnings: string[] = [],
): ParsedDocument {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (text.length > MAX_TEXT)
    throw new ImportError(
      '문서가 너무 큽니다. 편제표가 있는 부분을 별도 파일로 올려 주세요.',
    );
  return { format, text, warnings };
}

function readWorkbook(bytes: Buffer, format: string) {
  const book = XLSX.read(bytes, {
    type: 'buffer',
    cellFormula: false,
    cellHTML: false,
    cellText: true,
  });
  const sheets = book.SheetNames.map((name) => {
    const sheet = book.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1');
    if ((range.e.r + 1) * (range.e.c + 1) > 150_000)
      throw new ImportError(
        '시트 범위가 너무 큽니다. 편제표 부분만 올려 주세요.',
      );
    return {
      name,
      rows: XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: null,
        raw: false,
      }),
      merges: sheet['!merges'] ?? [],
    };
  });
  return boundedText(format, sheets);
}

function hwpText(data: Buffer) {
  let text = '';
  for (let i = 0; i + 1 < data.length; i += 2) {
    const code = data.readUInt16LE(i);
    if (code === 10 || code === 13) text += '\n';
    else if (code >= 32) text += String.fromCharCode(code);
    else if (
      [
        1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22,
        23,
      ].includes(code)
    ) {
      text += ' ';
      i += 14;
    }
  }
  return text;
}

function readHwp(container: CFB.CFB$Container) {
  const header = Buffer.from(
    CFB.find(container, 'FileHeader')!.content as Uint8Array,
  );
  if (
    header.length < 40 ||
    !header.subarray(0, 32).toString('ascii').startsWith('HWP Document File')
  )
    throw new ImportError('HWP 파일 헤더가 손상되었습니다.');
  const flags = header.readUInt32LE(36);
  if (flags & 6)
    throw new ImportError('암호화·배포용 HWP는 PDF로 변환해서 올려 주세요.');
  const sections = container.FullPaths.map((path, index) => ({
    path,
    entry: container.FileIndex[index],
  }))
    .filter((x) => /BodyText\/Section\d+$/.test(x.path))
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
  let expanded = 0;
  const content = sections.map(({ path, entry }) => {
    const packed = Buffer.from(entry.content as Uint8Array);
    const bytes =
      flags & 1
        ? inflateRawSync(packed, { maxOutputLength: MAX_EXPANDED })
        : packed;
    expanded += bytes.length;
    if (expanded > MAX_EXPANDED)
      throw new ImportError('HWP 압축 해제 크기가 너무 큽니다.');
    const records: {
      tag: number;
      level: number;
      text?: string;
      cell_header?: string;
    }[] = [];
    for (let offset = 0; offset < bytes.length;) {
      if (offset + 4 > bytes.length)
        throw new ImportError('HWP 레코드가 손상되었습니다.');
      const word = bytes.readUInt32LE(offset);
      offset += 4;
      const tag = word & 0x3ff;
      const level = (word >>> 10) & 0x3ff;
      let size = word >>> 20;
      if (size === 0xfff) {
        if (offset + 4 > bytes.length)
          throw new ImportError('HWP 레코드 크기가 손상되었습니다.');
        size = bytes.readUInt32LE(offset);
        offset += 4;
      }
      if (offset + size > bytes.length)
        throw new ImportError('HWP 레코드 범위가 손상되었습니다.');
      const data = bytes.subarray(offset, offset + size);
      offset += size;
      if (tag === 67) records.push({ tag, level, text: hwpText(data) });
      // Retain nesting and list/table records as evidence, but never certify cell geometry.
      else if (tag === 72 || tag === 77)
        records.push({
          tag,
          level,
          cell_header: data.subarray(0, 48).toString('hex'),
        });
    }
    return { section: path, records };
  });
  if (!sections.length) throw new ImportError('HWP 본문 스트림이 없습니다.');
  return boundedText('hwp', content, [
    'HWP의 표 셀 좌표를 완전히 복원하지 못했습니다. 원문과 학기별 열을 대조해야 합니다.',
  ]);
}

export function parseDocument(bytes: Buffer): ParsedDocument {
  if (!bytes.length || bytes.length > MAX_FILE_BYTES)
    throw new ImportError('빈 파일 또는 12MB를 초과한 파일입니다.');
  if (bytes.subarray(0, 5).toString('ascii') === '%PDF-')
    return { format: 'pdf', text: null, warnings: [] };
  if (bytes.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'))) {
    const container = CFB.read(bytes, { type: 'buffer' });
    if (CFB.find(container, 'FileHeader')) return readHwp(container);
    if (CFB.find(container, 'Workbook') || CFB.find(container, 'Book'))
      return readWorkbook(bytes, 'xls');
    throw new ImportError(
      '지원하지 않는 OLE 파일입니다. PDF로 변환해서 올려 주세요.',
    );
  }
  if (bytes.subarray(0, 4).equals(Buffer.from('504b0304', 'hex'))) {
    let total = 0;
    let count = 0;
    const entries = unzipSync(bytes, {
      filter: (file) => {
        total += file.originalSize;
        count++;
        if (total > MAX_EXPANDED || count > 3000)
          throw new ImportError('압축 문서의 크기 제한을 초과했습니다.');
        return /^(Contents\/.*\.xml|mimetype|xl\/workbook\.xml|word\/document\.xml)$/i.test(
          file.name,
        );
      },
    });
    if (entries['xl/workbook.xml']) return readWorkbook(bytes, 'xlsx');
    const sections = Object.keys(entries)
      .filter((name) => /^Contents\/section\d+\.xml$/i.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (sections.length) {
      const content = sections.map((name) => {
        const $ = load(Buffer.from(entries[name]).toString('utf8'), {
          xml: true,
        });
        // Keep XML table geometry (cellAddr/cellSpan), paragraphs, and cohort headings.
        return {
          section: name,
          xml: $.html({ xml: { decodeEntities: false } }),
        };
      });
      return boundedText('hwpx', content);
    }
    if (entries['word/document.xml'])
      return boundedText(
        'docx',
        Buffer.from(entries['word/document.xml']).toString('utf8'),
      );
    throw new ImportError('HWPX·XLSX·DOCX 내부 구조를 찾을 수 없습니다.');
  }
  const html = decodeDocument(bytes);
  if (/^\s*(?:\ufeff)?</.test(html) && /<table[\s>]/i.test(html)) {
    const $ = load(html);
    $('script,style,iframe,object').remove();
    const tables = $('table')
      .map((_, el) => $.html(el))
      .get();
    return boundedText('html', { text: $('body').text(), tables });
  }
  throw new ImportError(
    '지원하는 편제표 형식이 아닙니다. PDF·HWP·HWPX·XLS·XLSX·DOCX 파일을 올려 주세요.',
  );
}
