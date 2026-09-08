'use client';

import {
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  LoaderCircle,
  Search,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';

import {
  type ConfirmedCurriculum,
  curriculumFromImport,
} from '@/app/(private)/consulting/subject-selection/_lib/curriculum';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  Attachment,
  ImportResult,
  School,
} from '@/features/subject-selection/schema';

const endpoint = '/api/consulting/subject-selection';
const statusLabel = {
  verified: '검증 통과',
  review_required: '검토 필요',
  failed: '추출 실패',
};
const typeLabel = {
  school_required: '학교지정',
  student_choice: '학생선택',
  unknown: '구분 확인 필요',
};
const terms = [
  [2, 1],
  [2, 2],
  [3, 1],
  [3, 2],
] as const;

async function readResponse(response: Response) {
  if (response.redirected)
    throw new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '가져오기에 실패했습니다.');
  return data;
}

export function CurriculumImport({
  onConfirm,
}: {
  onConfirm: (curriculum: ConfirmedCurriculum) => void;
}) {
  const currentYear = new Date().getFullYear();
  const [query, setQuery] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [sourceYear, setSourceYear] = useState(currentYear);
  const [cohort, setCohort] = useState(currentYear);
  const [track, setTrack] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [fileId, setFileId] = useState('');
  const [upload, setUpload] = useState<File | null>(null);
  const [sourceMode, setSourceMode] = useState<'school' | 'upload'>('school');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const lock = useRef(false);

  async function run(label: string, action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setError('');
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : '가져오기에 실패했습니다.',
      );
    } finally {
      lock.current = false;
      setBusy('');
    }
  }

  const resetResult = () => {
    setResult(null);
    setReviewed(false);
  };
  const search = () =>
    run('학교 검색 중', async () => {
      setSchools([]);
      setSchool(null);
      setFiles([]);
      setFilesLoaded(false);
      resetResult();
      const data = await readResponse(
        await fetch(`${endpoint}?q=${encodeURIComponent(query)}`),
      );
      setSchools(data.schools);
      setSearched(true);
    });
  const loadFiles = () =>
    run('공시 파일 조회 중', async () => {
      if (!school) return;
      setFiles([]);
      setFileId('');
      resetResult();
      const data = await readResponse(
        await fetch(`${endpoint}?schoolId=${school.id}&year=${sourceYear}`),
      );
      setFiles(data.files);
      setFileId(data.files.find((f: Attachment) => f.score > 0)?.id ?? '');
      setFilesLoaded(true);
    });
  const extract = () =>
    run('편제표 분석 및 검증 중', async () => {
      resetResult();
      let body: FormData | string;
      if (sourceMode === 'upload') {
        if (!upload) return;
        body = new FormData();
        body.set('file', upload);
        body.set('school', schoolName);
        body.set('cohort', String(cohort));
        body.set('sourceYear', String(sourceYear));
        body.set('track', track);
      } else
        body = JSON.stringify({
          school: school?.name,
          schoolId: school?.id,
          sourceYear,
          cohort,
          fileId,
          track,
        });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 175_000);
      try {
        const data = await readResponse(
          await fetch(endpoint, {
            method: 'POST',
            body,
            headers:
              typeof body === 'string'
                ? { 'Content-Type': 'application/json' }
                : undefined,
            signal: controller.signal,
          }),
        );
        setResult(data);
      } finally {
        clearTimeout(timeout);
      }
    });

  function exportResult() {
    if (!result) return;
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { ...result, review: { acknowledged: reviewed } },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `교육과정-${result.school}-${result.targetCohort}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="space-y-6">
      <fieldset
        disabled={Boolean(busy)}
        className="min-w-0 space-y-5 disabled:opacity-70"
      >
        <div className="flex flex-wrap gap-5 border-b pb-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="curriculum-source"
              checked={sourceMode === 'school'}
              onChange={() => {
                setSourceMode('school');
                resetResult();
              }}
            />
            학교알리미
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="curriculum-source"
              checked={sourceMode === 'upload'}
              onChange={() => {
                setSourceMode('upload');
                resetResult();
              }}
            />
            파일 업로드
          </label>
        </div>
        <label className="block space-y-2 text-sm">
          <span>과정·학과 (선택)</span>
          <Input
            value={track}
            maxLength={100}
            placeholder="예: 일반 과정, 과학중점 과정"
            onChange={(e) => {
              setTrack(e.target.value);
              resetResult();
            }}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span>공시연도</span>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={sourceYear}
              onChange={(e) => {
                setSourceYear(Number(e.target.value));
                setFiles([]);
                setFileId('');
                setFilesLoaded(false);
                resetResult();
              }}
            />
          </label>
          <label className="space-y-2 text-sm">
            <span>학생 입학년도</span>
            <Input
              type="number"
              min={2000}
              max={2100}
              value={cohort}
              onChange={(e) => {
                setCohort(Number(e.target.value));
                resetResult();
              }}
            />
          </label>
        </div>
        {sourceMode === 'school' ? (
          <div className="space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void search();
              }}
              className="flex items-end gap-2"
            >
              <label className="min-w-0 flex-1 space-y-2 text-sm">
                <span>고등학교명</span>
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="학교명 검색"
                  maxLength={60}
                />
              </label>
              <Button
                type="submit"
                variant="outline"
                disabled={query.trim().length < 2}
              >
                <Search className="size-4" />
                검색
              </Button>
            </form>
            {searched && !schools.length && (
              <p className="text-sm text-muted-foreground">
                검색된 고등학교가 없습니다.
              </p>
            )}
            {schools.length > 0 && (
              <div className="max-h-60 overflow-auto divide-y border-y">
                {schools.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-3 py-3 text-sm"
                  >
                    <input
                      type="radio"
                      name="selected-school"
                      checked={school?.id === s.id}
                      onChange={() => {
                        setSchool(s);
                        setFiles([]);
                        setFileId('');
                        setFilesLoaded(false);
                        resetResult();
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block font-medium">{s.name}</span>
                      <span className="block break-words text-xs text-muted-foreground">
                        {s.address}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={!school}
              onClick={() => void loadFiles()}
            >
              <Download className="size-4" />
              공시 파일 가져오기
            </Button>
            {filesLoaded && !files.length && (
              <p className="text-sm text-muted-foreground">
                해당 연도에 공개된 첨부파일이 없습니다.
              </p>
            )}
            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  학교교육과정 편성·운영 및 평가에 관한 사항
                </p>
                <div className="divide-y border-y">
                  {files.map((file) => (
                    <div key={file.id} className="flex items-center gap-3 py-3">
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-sm">
                        <input
                          type="radio"
                          name="curriculum-file"
                          checked={fileId === file.id}
                          onChange={() => {
                            setFileId(file.id);
                            resetResult();
                          }}
                        />
                        <span className="min-w-0 break-all">{file.name}</span>
                        {file.score >= 60 && (
                          <Badge variant="secondary" className="shrink-0">
                            편제표 후보
                          </Badge>
                        )}
                      </label>
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 p-2"
                        title="원문 다운로드"
                        aria-label={`${file.name} 원문 다운로드`}
                      >
                        <Download className="size-4" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block space-y-2 text-sm">
              <span>학교명</span>
              <Input
                value={schoolName}
                maxLength={100}
                onChange={(e) => {
                  setSchoolName(e.target.value);
                  resetResult();
                }}
              />
            </label>
            <label className="block space-y-2 text-sm">
              <span className="flex items-center gap-2">
                <Upload className="size-4" />
                교육과정 원문 (12MB 이하)
              </span>
              <Input
                type="file"
                accept=".pdf,.hwp,.hwpx,.xls,.xlsx,.docx,.html,.htm"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  resetResult();
                  if (file && file.size > 12 * 1024 * 1024) {
                    setError('12MB 이하의 파일을 선택해 주세요.');
                    setUpload(null);
                    e.target.value = '';
                  } else {
                    setUpload(file);
                    setError('');
                  }
                }}
              />
            </label>
          </div>
        )}
        <Button
          type="button"
          onClick={() => void extract()}
          disabled={
            sourceMode === 'school'
              ? !school || !fileId
              : !upload || !schoolName.trim()
          }
        >
          <FileText className="size-4" />
          편제표 읽어오기
        </Button>
      </fieldset>
      {busy && (
        <p role="status" className="flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" />
          {busy}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="break-words border-l-2 border-destructive pl-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {result && (
        <section className="space-y-5 border-t pt-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">
                  {result.school} · {result.targetCohort}학년도 입학생
                </h2>
                <Badge
                  variant={
                    result.status === 'verified' ? 'secondary' : 'outline'
                  }
                >
                  {statusLabel[result.status]}
                </Badge>
              </div>
              <p className="break-all text-xs text-muted-foreground">
                {result.source.name} · {result.source.format.toUpperCase()}
                {result.track ? ` · ${result.track}` : ''}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={exportResult}>
              <Download className="size-4" />
              결과 저장
            </Button>
          </div>
          {result.validation.issues.length > 0 && (
            <details
              open
              className="border-l-2 border-amber-400 bg-amber-50/50 p-3 text-sm"
            >
              <summary className="cursor-pointer font-medium">
                확인할 항목 {result.validation.issues.length}개
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {result.validation.issues.map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            </details>
          )}
          {result.status !== 'failed' && (
            <>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                {terms.map(([grade, semester]) => {
                  const rows = result.curriculum.filter(
                    (r) => r.grade === grade && r.semester === semester,
                  );
                  const groups = result.selection_groups.filter(
                    (g) => g.grade === grade && g.semester === semester,
                  );
                  const total = result.validation.terms.find(
                    (t) => t.grade === grade && t.semester === semester,
                  );
                  const standalone = rows.filter(
                    (r) => !groups.some((g) => g.id === r.selection_group),
                  );
                  return (
                    <section
                      key={`${grade}-${semester}`}
                      className="min-w-0 border-t-2 border-neutral-300 pt-3"
                    >
                      <h3 className="mb-3 flex justify-between text-base font-semibold">
                        <span>
                          {grade}-{semester}
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                          {rows.length}과목
                        </span>
                      </h3>
                      {!rows.length && (
                        <p className="text-sm text-muted-foreground">
                          추출된 학기 자료 없음
                        </p>
                      )}
                      {standalone.map((r, i) => (
                        <div key={i} className="border-b py-2 text-sm">
                          <div className="flex items-start justify-between gap-2">
                            <span className="min-w-0 break-words">
                              {r.subject}
                            </span>
                            <span className="shrink-0 text-xs">
                              {r.credit ?? '?'}학점
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {typeLabel[r.type]}
                          </p>
                          <details className="mt-1 text-xs text-muted-foreground">
                            <summary className="cursor-pointer">
                              원문 근거
                            </summary>
                            {r.evidence}
                          </details>
                        </div>
                      ))}
                      {groups.map((g) => (
                        <div
                          key={g.id}
                          className="mt-4 border-l-2 border-emerald-500 pl-3"
                        >
                          <p className="text-sm font-medium">{g.name}</p>
                          <p className="mt-1 text-xs text-emerald-700">
                            {g.simple_count && g.choose !== null
                              ? `${g.subjects.length}과목 중 ${g.choose}과목 선택`
                              : '선택 조건 확인 필요'}
                          </p>
                          <p className="mt-1 break-words text-xs text-muted-foreground">
                            {g.rule_raw}
                          </p>
                          <ul className="mt-2 space-y-2 text-sm">
                            {g.subjects.map((subject, i) => {
                              const row = rows.find(
                                (r) =>
                                  r.selection_group === g.id &&
                                  r.subject === subject,
                              );
                              return (
                                <li key={i}>
                                  <div className="flex justify-between gap-2">
                                    <span className="min-w-0 break-words">
                                      {subject}
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                      {row?.credit ?? '?'}학점
                                    </span>
                                  </div>
                                  {row && (
                                    <details className="text-xs text-muted-foreground">
                                      <summary className="cursor-pointer">
                                        원문 근거
                                      </summary>
                                      {row.evidence}
                                    </details>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                      {total && (
                        <p className="mt-4 border-t pt-2 text-xs text-muted-foreground">
                          교과 학점: 계산 {total.calculated ?? '?'} / 원문{' '}
                          {total.reported ?? '?'} ·{' '}
                          {total.matches ? '일치' : '확인 필요'}
                        </p>
                      )}
                    </section>
                  );
                })}
              </div>
              {result.linked_rules.length > 0 && (
                <div className="space-y-2 border-t pt-4">
                  <h3 className="text-sm font-semibold">
                    학기 간 연동·이수 조건
                  </h3>
                  {result.linked_rules.map((r, i) => (
                    <p key={i} className="text-sm">
                      {r.rule_raw}
                    </p>
                  ))}
                </div>
              )}
              {!result.validation.cohort_match && (
                <p className="text-sm text-destructive">
                  입학년도가 확인되지 않아 확정할 수 없습니다. 대상 입학년도의
                  원문을 다시 선택해 주세요.
                </p>
              )}
              <div className="space-y-3 border-t pt-4">
                {result.status === 'review_required' && (
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                    />
                    원문과 확인할 항목을 검토했습니다.
                  </label>
                )}
                <Button
                  type="button"
                  disabled={
                    !result.validation.cohort_match ||
                    (result.status === 'review_required' && !reviewed)
                  }
                  onClick={() => onConfirm(curriculumFromImport(result))}
                >
                  <CheckCircle2 className="size-4" />
                  편제표 확정하고 다음 단계로
                </Button>
              </div>
            </>
          )}
        </section>
      )}
      <p className="flex items-center gap-1 border-t pt-3 text-xs text-muted-foreground">
        출처:{' '}
        <a
          href="https://www.schoolinfo.go.kr/ei/ss/pneiss_a03_s0.do"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 underline underline-offset-2"
        >
          학교알리미
          <ExternalLink className="size-3" />
        </a>
      </p>
    </div>
  );
}
