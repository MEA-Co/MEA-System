import { execFile as execFileCallback } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
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
type HwpRecord = {
  tag: number;
  level: number;
  text?: string;
  cell_header?: string;
  table_header?: string;
};
type HwpSection = {
  section: string;
  records: HwpRecord[];
};
type HwpTableCell = {
  row: number;
  col: number;
  rowSpan: number;
  colSpan: number;
  text: string;
};
type HwpTableGrid = {
  section: string;
  rows: number;
  columns: number;
  cells: HwpTableCell[];
};
const MAX_EXPANDED = 32 * 1024 * 1024;
const MAX_TEXT = 240_000;
const MAX_CONVERTED_PDF_PAGES = 120;
const HWP_CONTEXT_RADII = [240, 120, 60, 24] as const;
const execFile = promisify(execFileCallback);

function countPdfPages(bytes: Buffer) {
  return (
    bytes.toString('latin1').match(/\/Type\s*\/Page(?!s)\b/g)?.length ?? 0
  );
}

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

function hwpAnchorScore(record: HwpRecord) {
  const text = record.text?.replaceAll(/\s+/g, '') ?? '';
  if (!text) return 0;
  let score = 0;
  if (/교육과정|교과과정|편제표|교과편제|학점배당|이수학점|이수단위/.test(text))
    score += 12;
  if (/과목명|교과목|선택과목|필수과목|학년별|학기별/.test(text)) score += 8;
  if (/(?:1|2|3)학년|(?:1|2)학기|[123]-[12]/.test(text)) score += 3;
  if (/학점|단위|총계|합계/.test(text)) score += 2;
  return score;
}

function hwpContext(
  sections: HwpSection[],
  anchors: { sectionIndex: number; recordIndex: number; score: number }[],
  radius: number,
  maxWindows: number,
) {
  const selected = new Map<number, Set<number>>();
  const picked: typeof anchors = [];
  for (const anchor of [...anchors].sort((left, right) => right.score - left.score)) {
    if (picked.length >= maxWindows) break;
    if (
      picked.some(
        (previous) =>
          previous.sectionIndex === anchor.sectionIndex &&
          Math.abs(previous.recordIndex - anchor.recordIndex) < radius * 2,
      )
    ) {
      continue;
    }
    picked.push(anchor);
  }
  for (const anchor of picked) {
    const recordIndexes = selected.get(anchor.sectionIndex) ?? new Set<number>();
    const records = sections[anchor.sectionIndex].records;
    for (
      let index = Math.max(0, anchor.recordIndex - radius);
      index <= Math.min(records.length - 1, anchor.recordIndex + radius);
      index++
    ) {
      recordIndexes.add(index);
    }
    selected.set(anchor.sectionIndex, recordIndexes);
  }
  return sections
    .map((section, sectionIndex) => ({
      section: section.section,
      records: section.records.filter((_, recordIndex) =>
        selected.get(sectionIndex)?.has(recordIndex),
      ),
    }))
    .filter((section) => section.records.length);
}

function capHwpContext(sections: HwpSection[], maxText: number) {
  const budget = Math.max(1, maxText - 4_000);
  let used = 0;
  const compact: HwpSection[] = [];
  for (const section of sections) {
    const records: HwpRecord[] = [];
    for (const record of section.records) {
      const limited =
        record.text && record.text.length > 8_000
          ? { ...record, text: `${record.text.slice(0, 8_000)} [이하 생략]` }
          : record;
      const size = JSON.stringify(limited).length + 1;
      if (used + size > budget) break;
      records.push(limited);
      used += size;
    }
    if (records.length) compact.push({ section: section.section, records });
    if (used >= budget) break;
  }
  return compact;
}

export function preprocessHwpSections(sections: HwpSection[], maxText = MAX_TEXT) {
  if (JSON.stringify(sections).length <= maxText)
    return { sections, warnings: [] as string[] };

  const anchors = sections.flatMap((section, sectionIndex) =>
    section.records
      .map((record, recordIndex) => ({
        sectionIndex,
        recordIndex,
        score: hwpAnchorScore(record),
      }))
      .filter((anchor) => anchor.score > 0),
  );
  const priorityAnchors = anchors.filter((anchor) => anchor.score >= 8);
  const contextAnchors = priorityAnchors.length ? priorityAnchors : anchors;
  if (contextAnchors.length) {
    for (const radius of HWP_CONTEXT_RADII) {
      const context = hwpContext(sections, contextAnchors, radius, 10);
      if (JSON.stringify(context).length <= maxText)
        return {
          sections: context,
          warnings: [
            'HWP 원문이 커서 교육과정·편제·학점 표제 주변을 우선 분석했습니다. 원문과 대조가 필요합니다.',
          ],
        };
    }
  }

  const context = contextAnchors.length
    ? hwpContext(sections, contextAnchors, 24, 10)
    : [];
  const fallback = capHwpContext(context.length ? context : sections, maxText);
  return {
    sections: fallback,
    warnings: [
      'HWP 원문이 커서 교육과정·편제·학점 후보 일부만 분석했습니다. 원문과 대조가 필요합니다.',
    ],
  };
}

function parseHwpTableCell(header: string) {
  const bytes = Buffer.from(header, 'hex');
  if (bytes.length < 16) return null;
  const col = bytes.readUInt16LE(8);
  const row = bytes.readUInt16LE(10);
  const colSpan = bytes.readUInt16LE(12);
  const rowSpan = bytes.readUInt16LE(14);
  if (!colSpan || !rowSpan) return null;
  return { row, col, rowSpan, colSpan };
}

export function extractHwpTableGrids(sections: HwpSection[]) {
  const tables: HwpTableGrid[] = [];
  for (const section of sections) {
    for (let start = 0; start < section.records.length; start++) {
      const tableRecord = section.records[start];
      if (tableRecord.tag !== 77 || !tableRecord.table_header) continue;
      const header = Buffer.from(tableRecord.table_header, 'hex');
      if (header.length < 8) continue;
      const rows = header.readUInt16LE(4);
      const columns = header.readUInt16LE(6);
      if (!rows || !columns || rows > 1_000 || columns > 100) continue;

      const cells: HwpTableCell[] = [];
      let current: HwpTableCell | null = null;
      for (let index = start + 1; index < section.records.length; index++) {
        const record = section.records[index];
        if (record.tag === 77 && record.level <= tableRecord.level) break;
        if (record.tag === 72 && record.level === tableRecord.level) {
          const position = record.cell_header && parseHwpTableCell(record.cell_header);
          current = position
            ? { ...position, text: '' }
            : null;
          if (current) cells.push(current);
          continue;
        }
        if (current && record.tag === 67 && record.level > tableRecord.level)
          current.text += record.text ?? '';
      }
      const populatedCells = cells
        .map((cell) => ({ ...cell, text: cell.text.replaceAll(/\s+/g, ' ').trim() }))
        .filter((cell) => cell.text);
      if (populatedCells.length)
        tables.push({ section: section.section, rows, columns, cells: populatedCells });
    }
  }
  return tables;
}

function hwpTableScore(table: HwpTableGrid) {
  const text = table.cells.map((cell) => cell.text).join(' ');
  let score = 0;
  if (/2026학년도\s*입학생/.test(text)) score += 40;
  if (/과학중점/.test(text)) score += 30;
  if (/교육과정|편제|학점배당/.test(text)) score += 12;
  if (/과목|학점/.test(text)) score += 4;
  return score;
}

function hwpTableContext(tables: HwpTableGrid[]) {
  const selected: HwpTableGrid[] = [];
  let used = 0;
  for (const table of [...tables].sort((left, right) => hwpTableScore(right) - hwpTableScore(left))) {
    const size = JSON.stringify(table).length;
    if (size > 90_000 || used + size > 170_000) continue;
    selected.push(table);
    used += size;
  }
  return selected;
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
    const records: HwpRecord[] = [];
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
      else if (tag === 72)
        records.push({
          tag,
          level,
          cell_header: data.subarray(0, 48).toString('hex'),
        });
      else if (tag === 77)
        records.push({
          tag,
          level,
          table_header: data.subarray(0, 48).toString('hex'),
        });
    }
    return { section: path, records };
  });
  if (!sections.length) throw new ImportError('HWP 본문 스트림이 없습니다.');
  const tables = hwpTableContext(extractHwpTableGrids(content));
  const tableSize = JSON.stringify(tables).length;
  const preprocessed = preprocessHwpSections(
    content,
    Math.max(20_000, MAX_TEXT - tableSize - 1_000),
  );
  return boundedText('hwp', { tables, sections: preprocessed.sections }, [
    'HWP 표의 셀 좌표와 병합 범위를 함께 분석했습니다. 원문과 학기별 열을 대조해야 합니다.',
    ...preprocessed.warnings,
  ]);
}

export function isHwpDocument(bytes: Buffer) {
  if (!bytes.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex')))
    return false;
  try {
    return Boolean(CFB.find(CFB.read(bytes, { type: 'buffer' }), 'FileHeader'));
  } catch {
    return false;
  }
}

async function runSoffice(
  inputPath: string,
  outputDirectory: string,
  outputPath: string,
  profilePath: string,
) {
  const candidates = [
    process.env.SOFFICE_PATH,
    '/Applications/LibreOffice.app/Contents/MacOS/soffice',
    'soffice',
  ].filter((candidate): candidate is string => Boolean(candidate));
  const args = [
    '--headless',
    '--nologo',
    '--nofirststartwizard',
    `-env:UserInstallation=${pathToFileURL(profilePath).href}`,
    '--convert-to',
    'pdf:writer_pdf_Export',
    '--outdir',
    outputDirectory,
    inputPath,
  ];

  for (const candidate of [...new Set(candidates)]) {
    if (candidate.startsWith('/') && !existsSync(candidate)) continue;
    try {
      await execFile(candidate, args, { timeout: 90_000, maxBuffer: 1_000_000 });
      if (existsSync(outputPath)) return true;
    } catch {
      // A configured executable or PATH entry can be stale; try the next known location.
    }
  }
  return false;
}

export async function convertHwpToPdf(bytes: Buffer) {
  if (!isHwpDocument(bytes)) return null;

  const directory = await mkdtemp('/tmp/mea-subject-selection-');
  const inputPath = join(directory, 'curriculum.hwp');
  const outputPath = join(directory, 'curriculum.pdf');
  const profilePath = join(directory, 'libreoffice-profile');
  try {
    await writeFile(inputPath, bytes);
    const converted = await runSoffice(
      inputPath,
      directory,
      outputPath,
      profilePath,
    );
    if (!converted)
      return {
        pdf: null,
        warning:
          'HWP를 PDF로 변환하지 못했습니다. LibreOffice 설치 상태를 확인한 뒤 텍스트 방식으로 분석합니다.',
      };
    if (!existsSync(outputPath))
      return {
        pdf: null,
        warning: 'HWP를 PDF로 변환하지 못해 텍스트 방식으로 분석합니다.',
      };
    const pdf = await readFile(outputPath);
    if (!pdf.length || pdf.length > MAX_FILE_BYTES)
      return {
        pdf: null,
        warning:
          '변환된 PDF가 비어 있거나 너무 커서 HWP 텍스트 방식으로 분석합니다.',
      };
    const pageCount = countPdfPages(pdf);
    if (pageCount > MAX_CONVERTED_PDF_PAGES)
      return {
        pdf: null,
        warning: `HWP 변환 PDF가 ${pageCount}쪽으로 비정상적으로 길어 원본 HWP 텍스트·표 레코드 방식으로 분석합니다.`,
      };
    return {
      pdf,
      warning:
        '원본 HWP를 PDF로 변환해 표의 페이지·열 구조를 기준으로 분석했습니다. 원문 대조가 필요합니다.',
    };
  } catch {
    return {
      pdf: null,
      warning: 'HWP를 PDF로 변환하지 못해 텍스트 방식으로 분석합니다.',
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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
