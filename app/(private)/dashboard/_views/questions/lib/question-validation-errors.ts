import type { z } from 'zod';

export type QuestionValidationIssue = {
  path: (string | number)[];
  message: string;
};

const labels: Record<string, string> = {
  title: '관리용 이름',
  prompt: '질문 본문',
  label: '제목',
  text: '내용',
  fields: '답변 열',
  details: '설명 항목',
  options: '선택지',
  maxRows: '최대 항목 수',
  minRows: '최소 작성 항목 수',
  initialRows: '처음 표시할 항목 수',
  condition: '조건 설정',
  rowLabels: '항목 이름',
  sourceBlockId: '참조 질문',
  sourceFieldId: '참조 열',
  afterBlockId: '선행 질문',
  flowInsertAfter: '시기 추가 위치',
  scaleMax: '척도 만점',
  scaleConfig: '척도 설정',
  low: '낮은 값 설명',
  middle: '중간 값 설명',
  high: '높은 값 설명',
};

// Shared by the editor and HTTP boundary; completion/submission validation is separate.
export function questionValidationFailure(issues: z.core.$ZodIssue[]) {
  const fieldErrors: QuestionValidationIssue[] = issues.map((issue) => {
    const path = issue.path.filter(
      (part): part is string | number => typeof part !== 'symbol',
    );
    const location = path
      .filter((part) => part !== 'document')
      .map((part) =>
        typeof part === 'number' ? `${part + 1}번` : (labels[part] ?? part),
      )
      .join(' · ');
    let reason =
      issue.code === 'custom' ? issue.message : '값을 확인해 주세요.';
    if (issue.code === 'too_big')
      reason = `허용된 최대 길이 또는 개수(${String(issue.maximum)})를 초과했어요.`;
    if (issue.code === 'too_small')
      reason = `최소 길이 또는 개수(${String(issue.minimum)})를 충족해야 해요.`;
    return { path, message: location ? `${location}: ${reason}` : reason };
  });
  return {
    code: 'question_validation_failed',
    error: fieldErrors[0]?.message ?? '질문 내용을 확인해 주세요.',
    fieldErrors,
  };
}
