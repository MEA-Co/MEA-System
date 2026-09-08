import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import * as CFB from 'cfb';
import { strToU8, zipSync } from 'fflate';
import ts from 'typescript';
import * as XLSX from 'xlsx';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.startsWith('.') &&
      context.parentURL?.includes('/features/subject-selection/')
    ) {
      const url = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(url)) return nextResolve(url.href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith('.ts') && url.includes('/features/subject-selection/')) {
      return {
        format: 'module',
        shortCircuit: true,
        source: ts.transpileModule(readFileSync(fileURLToPath(url), 'utf8'), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});

const { extractionSchema, validateExtraction } =
  await import('../features/subject-selection/schema.ts');
const { parseDocument } =
  await import('../features/subject-selection/document.ts');
const { parseAttachments, searchSchools, listAttachments, downloadAttachment } =
  await import('../features/subject-selection/schoolinfo.ts');
const {
  findPriorityProfile,
  findUniversityMatches,
  normalizeCourseName,
  ruleMatchesCourse,
} = await import('../features/subject-selection/recommendations.ts');

function fixture() {
  const data = {
    table_found: true,
    table_title: '2026학년도 입학생 교육과정 편제표',
    cohort: 2026,
    cohort_evidence: '1쪽 제목: 2026학년도 입학생',
    structure_clear: true,
    curriculum: [],
    selection_groups: [],
    linked_rules: [],
    totals: [],
    warnings: [],
  };
  for (const [grade, semester] of [
    [2, 1],
    [2, 2],
    [3, 1],
    [3, 2],
  ]) {
    const id = `G${grade}S${semester}A`;
    data.curriculum.push({
      grade,
      semester,
      subject: '문학',
      subject_group: '국어',
      credit: 4,
      type: 'school_required',
      selection_group: null,
      evidence: '1쪽 학교지정 문학 4',
    });
    for (const subject of ['경제', '정치와 법', '사회와 문화'])
      data.curriculum.push({
        grade,
        semester,
        subject,
        subject_group: '사회',
        credit: 3,
        type: 'student_choice',
        selection_group: id,
        evidence: `1쪽 ${subject} 3`,
      });
    data.selection_groups.push({
      id,
      grade,
      semester,
      name: id,
      choose: 2,
      from: 3,
      subjects: ['경제', '정치와 법', '사회와 문화'],
      rule_raw: '3과목 중 택2',
      simple_count: true,
    });
    data.totals.push({
      grade,
      semester,
      credit: 10,
      scope: 'subjects_only',
      evidence: '1쪽 교과 이수학점 10',
    });
  }
  return extractionSchema.parse(data);
}

test('학점 합계는 후보 전체가 아닌 필수 + 택 N으로 계산한다', () => {
  const checked = validateExtraction(fixture(), 2026);
  assert.equal(checked.status, 'verified');
  assert.equal(checked.validation.terms[0].calculated, 10);
});
test('누락 총계, 잘못된 코호트, 중복, 복합조건은 자동 확정하지 않는다', () => {
  for (const mutate of [
    (d) => {
      d.totals = [];
    },
    (d) => {
      d.cohort = 2025;
    },
    (d) => {
      d.curriculum.push(d.curriculum[0]);
    },
    (d) => {
      d.selection_groups[0].simple_count = false;
    },
    (d) => {
      d.selection_groups[0].from = 4;
    },
    (d) => {
      d.curriculum[0].credit = null;
    },
    (d) => {
      d.curriculum[1].selection_group = 'missing';
    },
    (d) => {
      d.curriculum[1].credit = 4;
    },
    (d) => {
      d.cohort_evidence = '';
    },
    (d) => {
      d.totals[0].scope = 'including_activities';
    },
  ]) {
    const data = fixture();
    mutate(data);
    assert.equal(validateExtraction(data, 2026).status, 'review_required');
  }
});
test('HWP 불완전 표 구조는 합계가 맞아도 검토 필요', () => {
  assert.equal(
    validateExtraction(fixture(), 2026, ['HWP 셀 구조 확인 필요']).status,
    'review_required',
  );
});

test('원문 후보 수가 없어도 알려진 택 N의 계산값은 보존하고 검토를 요구한다', () => {
  const data = fixture();
  data.selection_groups[0].from = null;
  const checked = validateExtraction(data, 2026);
  assert.equal(checked.status, 'review_required');
  assert.equal(checked.validation.terms[0].calculated, 10);
});
test('편제표가 없으면 failed', () => {
  const data = fixture();
  data.table_found = false;
  assert.equal(validateExtraction(data, 2026).status, 'failed');
});
test('파일 시그니처와 ZIP/OLE 내부 구조로 포맷을 구분한다', () => {
  assert.equal(parseDocument(Buffer.from('%PDF-1.4\n')).format, 'pdf');
  assert.equal(
    parseDocument(
      Buffer.from('<html><table><tr><td>과목</td></tr></table></html>'),
    ).format,
    'html',
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['교육과정 편제표', '2학년'],
      ['문학', 4],
    ]),
    '2026 입학생',
  );
  for (const format of ['xlsx', 'xls'])
    assert.equal(
      parseDocument(XLSX.write(workbook, { type: 'buffer', bookType: format }))
        .format,
      format,
    );
  const xml =
    '<hs:sec xmlns:hs="section" xmlns:hp="paragraph"><hp:p><hp:t>2026 입학생 편제표</hp:t></hp:p><hp:tbl><hp:tr><hp:tc><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="2" rowSpan="1"/><hp:p><hp:t>문학</hp:t></hp:p></hp:tc></hp:tr></hp:tbl></hs:sec>';
  const hwpx = parseDocument(
    Buffer.from(zipSync({ 'Contents/section0.xml': strToU8(xml) })),
  );
  assert.equal(hwpx.format, 'hwpx');
  assert.match(hwpx.text, /colSpan/);
  assert.match(hwpx.text, /문학/);
  assert.throws(() =>
    parseDocument(Buffer.from(zipSync({ 'other.txt': strToU8('unknown') }))),
  );
  assert.throws(() => parseDocument(Buffer.from('not a curriculum')));
});
test('HWP 레코드 계층은 보존하되 텍스트만으로 표 구조를 확정하지 않는다', () => {
  const container = CFB.utils.cfb_new();
  const header = Buffer.alloc(256);
  header.write('HWP Document File');
  CFB.utils.cfb_add(container, 'FileHeader', header);
  const text = Buffer.from('교육과정 편제표', 'utf16le');
  const word = Buffer.alloc(4);
  word.writeUInt32LE(67 | (text.length << 20));
  CFB.utils.cfb_add(
    container,
    'BodyText/Section0',
    Buffer.concat([word, text]),
  );
  const result = parseDocument(CFB.write(container, { type: 'buffer' }));
  assert.equal(result.format, 'hwp');
  assert.match(result.text, /교육과정 편제표/);
  assert.ok(result.warnings.length);
});
test('학사일정이 먼저 있어도 편성운영을 우선 추천하고 모든 첨부를 보존한다', () => {
  const params = {
    SHL_IDF_CD: 'school',
    JG_YEAR: '2026',
    JG_BURYU_CD: 'JG020',
    JG_HANGMOK_CD: '05',
    JG_GUBUN: '1',
    JG_CHASU: '1',
    USE_YN: 'Y',
  };
  const html = `<form id="eiFileDownForm">${Object.entries(params)
    .map(([name, value]) => `<input name="${name}" value="${value}">`)
    .join(
      '',
    )}</form><a class="file_name" onclick="getEiFile14('1')">학사일정.pdf(100 KB)</a><a class="file_name" onclick="getEiFile14('0')">교육과정 편성운영.pdf(200 KB)</a>`;
  const files = parseAttachments(html, 'school', 2026);
  assert.equal(files.length, 2);
  assert.equal(files[0].id, '0');
  assert.equal(files[0].name, '교육과정 편성운영.pdf');
  assert.equal(new URL(files[0].url).hostname, 'www.schoolinfo.go.kr');
  assert.throws(() => parseAttachments(html, 'other-school', 2026));
  assert.throws(() => parseAttachments(html, 'school', 2025));
});

test('학과명과 2022 개정 과목 표기를 정규화해 추천 기준을 연결한다', () => {
  assert.equal(
    normalizeCourseName('미적분Ⅱ'),
    normalizeCourseName('미적분 II'),
  );
  assert.equal(
    findPriorityProfile('컴퓨터공학과')?.profile.id,
    'math-computing',
  );
  assert.equal(
    findPriorityProfile('화학공학과')?.profile.id,
    'physics-chemistry-combined',
  );
  assert.equal(findPriorityProfile('고고미술사학과')?.profile.id, 'history');
});

test('희망 학과와 충분히 가까운 대학 모집단위만 연결한다', () => {
  const matches = findUniversityMatches('컴퓨터공학과', 'math-computing');
  assert.deepEqual(
    matches.map((match) => match.university),
    ['고려대', '연세대', '경희대', '중앙대'],
  );
  assert.match(
    matches.find((match) => match.university === '연세대').matchedDepartment,
    /컴퓨터과학과/,
  );
  assert.match(
    matches.find((match) => match.university === '중앙대').matchedDepartment,
    /소프트웨어학부/,
  );
  assert.equal(findUniversityMatches('문예창작학과', 'language').length, 0);
});

test('대학의 개별 과목과 과목군 규칙을 모두 과목에 표시한다', () => {
  const matches = findUniversityMatches('컴퓨터공학과', 'math-computing');
  const yonsei = matches.find((match) => match.university === '연세대');
  const kyunghee = matches.find((match) => match.university === '경희대');
  assert.ok(
    yonsei.rules.some((rule) =>
      ruleMatchesCourse(rule, {
        name: '전자기와 양자',
        domain: '과학',
        selectionType: 'convergence',
      }),
    ),
  );
  assert.ok(
    kyunghee.rules.some((rule) =>
      ruleMatchesCourse(rule, {
        name: '인공지능 수학',
        domain: '수학',
        selectionType: 'convergence',
      }),
    ),
  );
});

test(
  '학교알리미 실제 검색·첨부 조회·PDF 다운로드',
  { skip: !process.env.SUBJECT_SELECTION_LIVE },
  async () => {
    const { schools } = await searchSchools('서울고등학교');
    const school = schools.find((s) => s.name === '서울고등학교');
    assert.ok(school);
    const files = await listAttachments(school.id, 2026);
    assert.ok(files.length >= 2);
    assert.match(files[0].name, /편성/);
    const { bytes } = await downloadAttachment(school.id, 2026, files[0].id);
    assert.equal(parseDocument(bytes).format, 'pdf');
  },
);
