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
const {
  extractHwpTableGrids,
  isHwpDocument,
  parseDocument,
  preprocessHwpSections,
} = await import('../features/subject-selection/document.ts');
const { courseMatchesSchoolRequirement, schoolCourseRequirements } =
  await import('../features/subject-selection/graduation.ts');
const { parseAttachments, searchSchools, listAttachments, downloadAttachment } =
  await import('../features/subject-selection/schoolinfo.ts');
const {
  courseDomainMatches,
  findPriorityProfile,
  coreChoiceStatuses,
  findUniversityMatches,
  normalizeCourseName,
  ruleMatchesCourse,
} = await import('../features/subject-selection/recommendations.ts');

const { universityRuleStatus } =
  await import('../features/subject-selection/university-status.ts');

test('university status counts normalized subjects once and requires named subjects', () => {
  const rule = {
    category: 'recommended',
    courses: ['물리학', '화학', '생명과학'],
    choose: 2,
    requiredCourses: ['화학'],
    note: '',
  };
  const courses = ['물리학', '물리 학', '생명과학'].map((name) => ({
    name,
    domain: '과학',
  }));
  const status = universityRuleStatus(rule, courses);
  assert.equal(status.count, 2);
  assert.equal(status.satisfied, false);
  assert.deepEqual(status.missingNames, ['화학']);
  assert.equal(
    universityRuleStatus(rule, [...courses, { name: '화학', domain: '과학' }])
      .satisfied,
    true,
  );
});

test('university status filters domain and selection type', () => {
  const rule = {
    category: 'recommended',
    domain: '과학',
    selectionType: 'career',
    choose: 2,
    note: '',
  };
  const courses = [
    { name: '물리학', domain: '과학', selectionType: 'general' },
    { name: '역학과 에너지', domain: '과학', selectionType: 'career' },
    { name: '기하', domain: '수학', selectionType: 'career' },
  ];
  const status = universityRuleStatus(rule, courses);
  assert.equal(status.count, 1);
  assert.equal(status.target, 2);
  assert.equal(status.satisfied, false);
});

function fixture() {
  const data = {
    table_found: true,
    table_title: '2026학년도 입학생 교육과정 편제표',
    track_matched: true,
    track_evidence: '2026학년도 입학생 [과학중점과정] 표',
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
test('요청한 과정의 원문 근거가 없으면 확정하지 않는다', () => {
  const data = fixture();
  data.track_matched = false;
  data.track_evidence = null;
  assert.equal(
    validateExtraction(data, 2026, [], '과학중점 과정').status,
    'failed',
  );
});
test('일반과정은 과정 표지 없이도 학년·학기 검증 결과를 사용한다', () => {
  const data = fixture();
  data.track_matched = null;
  data.track_evidence = null;
  assert.equal(
    validateExtraction(data, 2026, [], '일반 과정').status,
    'verified',
  );
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
  const bytes = CFB.write(container, { type: 'buffer' });
  assert.equal(isHwpDocument(bytes), true);
  const result = parseDocument(bytes);
  assert.equal(result.format, 'hwp');
  assert.match(result.text, /교육과정 편제표/);
  assert.ok(result.warnings.length);
});

test('큰 HWP는 편제표 표제 주변 레코드만 전처리해 분석 크기를 제한한다', () => {
  const filler = '학교 행사 안내와 교육활동 기록 '.repeat(16);
  const records = Array.from({ length: 3_200 }, (_, index) => ({
    tag: 67,
    level: 0,
    text:
      index === 1_600
        ? '2026학년도 입학생 교육과정 편제표 2학년 1학기 과목명 학점'
        : filler,
  }));
  const processed = preprocessHwpSections([
    { section: 'BodyText/Section0', records },
  ]);

  assert.ok(processed.warnings.length);
  assert.ok(JSON.stringify(processed.sections).length <= 240_000);
  assert.match(JSON.stringify(processed.sections), /교육과정 편제표/);
});
test('HWP 표 셀 좌표와 병합 범위를 텍스트와 함께 복원한다', () => {
  const tableHeader = Buffer.alloc(8);
  tableHeader.writeUInt16LE(2, 4);
  tableHeader.writeUInt16LE(3, 6);
  const cellHeader = (col, row, colSpan = 1, rowSpan = 1) => {
    const header = Buffer.alloc(16);
    header.writeUInt16LE(col, 8);
    header.writeUInt16LE(row, 10);
    header.writeUInt16LE(colSpan, 12);
    header.writeUInt16LE(rowSpan, 14);
    return header.toString('hex');
  };
  const tables = extractHwpTableGrids([
    {
      section: 'BodyText/Section0',
      records: [
        { tag: 77, level: 1, table_header: tableHeader.toString('hex') },
        { tag: 72, level: 1, cell_header: cellHeader(0, 0, 2) },
        { tag: 67, level: 2, text: '교육과정 편제표' },
        { tag: 72, level: 1, cell_header: cellHeader(2, 0) },
        { tag: 67, level: 2, text: '학점' },
      ],
    },
  ]);
  assert.deepEqual(tables, [
    {
      section: 'BodyText/Section0',
      rows: 2,
      columns: 3,
      cells: [
        { row: 0, col: 0, rowSpan: 1, colSpan: 2, text: '교육과정 편제표' },
        { row: 0, col: 2, rowSpan: 1, colSpan: 1, text: '학점' },
      ],
    },
  ]);
});
test('학교 편제표의 과학중점 이수 조건은 학기별·통합 조건으로 분리한다', () => {
  const requirements = schoolCourseRequirements([
    '(과학) 과학 교과 과목을 2학년 2학기에 2개 과목 이상 선택, 3학년 1학기에 3개 이상 선택해야 함',
    '(수학, 과학, 정보) 2, 3학년에서 수학, 과학, 정보 교과 과목을 12개 이상 선택해야 함',
  ]);
  assert.deepEqual(
    requirements.map(({ label, grade, semester, minimumCourses }) => ({
      label,
      grade,
      semester,
      minimumCourses,
    })),
    [
      { label: '과학 · 2-2', grade: 2, semester: 2, minimumCourses: 2 },
      { label: '과학 · 3-1', grade: 3, semester: 1, minimumCourses: 3 },
      {
        label: '수학·과학·정보',
        grade: null,
        semester: null,
        minimumCourses: 12,
      },
    ],
  );
  assert.equal(
    courseMatchesSchoolRequirement(
      { name: '인공지능 기초', domain: '기술·가정/정보' },
      requirements[2],
    ),
    true,
  );
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
    'computing-engineering',
  );
  assert.equal(
    findPriorityProfile('화학공학과')?.profile.id,
    'physics-chemistry-combined',
  );
  assert.equal(findPriorityProfile('고고미술사학과')?.profile.id, 'history');
});

test('기초 Core와 과학 심화 추천을 분리하고 공학별 물리 우선순위를 유지한다', () => {
  for (const department of [
    '기계공학과',
    '전기전자공학과',
    '화학공학과',
    '화학생명공학과',
    '환경공학과',
    '건축공학과',
  ]) {
    const profile = findPriorityProfile(department)?.profile;
    assert.ok(profile.core.includes('물리학'), department);
    assert.ok(!profile.core.includes('화학 반응의 세계'), department);
  }
  const bio = findPriorityProfile('생명공학과')?.profile;
  assert.equal(bio.id, 'bio-engineering');
  assert.deepEqual(bio.core, ['미적분 II', '화학', '생명과학']);
  assert.ok(bio.subCore.includes('물리학'));
  assert.ok(bio.subCore.includes('화학 반응의 세계'));
  assert.ok(
    !findPriorityProfile('컴퓨터공학과').profile.core.includes('물리학'),
  );
  assert.ok(
    findPriorityProfile('컴퓨터공학과').profile.subCore.includes('물리학'),
  );
  assert.equal(findPriorityProfile('건축학과').profile.id, 'architecture');
  assert.equal(
    findPriorityProfile('환경공학과').profile.id,
    'environmental-engineering',
  );
  assert.equal(findPriorityProfile('통계학과').profile.id, 'math-computing');
});

test('학과별 지정 심화 및 선택형 Core의 개수와 포함 조건을 확인한다', () => {
  const mechanical = findPriorityProfile('기계공학과').profile;
  const electronics = findPriorityProfile('전자공학과').profile;
  assert.ok(mechanical.core.includes('역학과 에너지'));
  assert.ok(!mechanical.core.includes('전자기와 양자'));
  assert.ok(electronics.core.includes('전자기와 양자'));
  assert.ok(!electronics.core.includes('역학과 에너지'));
  const chemistry = findPriorityProfile('화학공학과').profile;
  const check = (names) =>
    coreChoiceStatuses(
      chemistry,
      names.map((name) => ({ name })),
    )[0];
  assert.equal(check(['역학과 에너지', '전자기와 양자']).satisfied, false);
  assert.equal(check(['물질과 에너지']).satisfied, false);
  assert.equal(check(['물질과 에너지', '물질과 에너지']).count, 1);
  assert.equal(check(['물질과 에너지', '역학과 에너지']).satisfied, true);
  assert.equal(check(['물질과 에너지', '화학 반응의 세계']).satisfied, true);
  assert.equal(
    coreChoiceStatuses(findPriorityProfile('신소재공학과').profile, [
      { name: '역학과 에너지' },
      { name: '전자기와 양자' },
    ])[0].satisfied,
    true,
  );
  const energy = findPriorityProfile('원자력공학과').profile;
  assert.ok(energy.core.includes('역학과 에너지'));
  assert.ok(!energy.coreChoices[0].courses.includes('역학과 에너지'));
  assert.equal(
    coreChoiceStatuses(findPriorityProfile('생명공학과').profile, [
      { name: '세포와 물질대사' },
    ])[0].satisfied,
    true,
  );
});

test('새 내부 유형에서도 기존 대학별 권장과목 매칭이 유지된다', () => {
  for (const [department, previousId] of [
    ['컴퓨터공학과', 'math-computing'],
    ['생명공학과', 'chemistry-biology'],
    ['식품공학과', 'chemistry-biology'],
    ['건축학과', 'physics-earth'],
  ]) {
    const nextId = findPriorityProfile(department).profile.id;
    const before = findUniversityMatches(department, previousId);
    assert.ok(before.length, department);
    assert.deepEqual(
      findUniversityMatches(department, nextId),
      before,
      department,
    );
  }
});

test('문과 Core와 Sub core는 계열 안에서도 학과별 기초와 방향을 구분한다', () => {
  const policies = [
    [
      '국어국문학과',
      ['주제 탐구 독서'],
      ['독서 토론과 글쓰기', '언어생활 탐구'],
    ],
    [
      '영어영문학과',
      ['주제 탐구 독서'],
      ['독서 토론과 글쓰기', '언어생활 탐구', '영미 문학 읽기'],
    ],
    ['사학과', ['세계사'], ['동아시아 역사 기행', '역사로 탐구하는 현대 세계']],
    [
      '철학과',
      ['윤리와 사상'],
      ['인간과 철학', '논리와 사고', '인문학과 윤리'],
    ],
    [
      '윤리교육과',
      ['윤리와 사상', '현대사회와 윤리'],
      ['윤리문제 탐구', '인간과 철학'],
    ],
    [
      '정치외교학과',
      ['정치'],
      ['법과 사회', '국제 관계의 이해', '사회와 문화'],
    ],
    [
      '행정학과',
      ['정치', '사회와 문화'],
      ['법과 사회', '경제', '사회문제 탐구'],
    ],
    ['법학과', ['법과 사회', '정치'], ['현대사회와 윤리', '논리와 사고']],
    [
      '경제학과',
      ['경제', '경제수학'],
      ['확률과 통계', '실용 통계', '금융과 경제생활', '미적분 II'],
    ],
    [
      '경영학과',
      ['경제'],
      ['경제수학', '확률과 통계', '사회와 문화', '인간과 심리', '미적분 II'],
    ],
    [
      '무역학과',
      ['경제'],
      ['세계시민과 지리', '국제 관계의 이해', '경제수학'],
    ],
    [
      '국제통상학과',
      ['경제'],
      ['세계시민과 지리', '국제 관계의 이해', '경제수학'],
    ],
    ['국제학과', ['정치'], ['경제', '국제 관계의 이해', '세계시민과 지리']],
    ['사회학과', ['사회와 문화'], ['사회문제 탐구', '실용 통계']],
    [
      '사회복지학과',
      ['사회와 문화'],
      ['사회문제 탐구', '인간과 심리', '현대사회와 윤리'],
    ],
    [
      '심리학과',
      ['사회와 문화', '확률과 통계'],
      ['인간과 심리', '실용 통계', '생명과학'],
    ],
    [
      '상담심리학과',
      ['사회와 문화', '확률과 통계'],
      ['인간과 심리', '실용 통계', '생명과학'],
    ],
    [
      '미디어학과',
      ['사회와 문화'],
      ['매체 의사소통', '독서 토론과 글쓰기', '문학과 영상'],
    ],
    [
      '광고홍보학과',
      ['사회와 문화'],
      ['매체 의사소통', '인간과 심리', '경제', '실용 통계', '문학과 영상'],
    ],
  ];
  for (const [department, core, subCore] of policies) {
    const profile = findPriorityProfile(department).profile;
    assert.equal(profile.matchedDepartment, department);
    assert.deepEqual(profile.core, core, department);
    assert.deepEqual(profile.subCore, subCore, department);
    assert.deepEqual(profile.coreChoices, [], department);
    assert.ok(
      !profile.subCore.some((name) => profile.core.includes(name)),
      department,
    );
  }
  for (const department of [
    '불어불문학과',
    '독어독문학과',
    '중어중문학과',
    '일어일문학과',
  ]) {
    assert.ok(
      !findPriorityProfile(department).profile.subCore.includes(
        '영미 문학 읽기',
      ),
    );
  }
  assert.deepEqual(findPriorityProfile('광고홍보학부').profile.core, [
    '사회와 문화',
  ]);
  assert.deepEqual(
    findPriorityProfile('언론정보학과').profile.subCore,
    findPriorityProfile('신문방송학과').profile.subCore,
  );
  // Department overrides must not mutate the shared family for subsequent lookups.
  assert.deepEqual(findPriorityProfile('정치학과').profile.core, ['정치']);
  assert.deepEqual(findPriorityProfile('철학과').profile.core, ['윤리와 사상']);
});

test('추천 과목군은 편제표의 확장 교과 영역 표기도 함께 매칭한다', () => {
  const profile = findPriorityProfile('경영학과')?.profile;
  assert.ok(profile);
  assert.ok(
    profile.recommendDomains.some((domain) =>
      courseDomainMatches(domain, '사회(역사/도덕 포함)'),
    ),
  );
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
