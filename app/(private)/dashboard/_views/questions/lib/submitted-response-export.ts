import { flowRowLabel, materializeFlowRows } from './flow-rows';
import type { QuestionBlockField } from './question-blocks';
import type { QuestionResponseSnapshot } from './question-responses';
import {
  choiceAnswerId,
  choiceAnswerValue,
  scaleAnswer,
  scaleLabel,
} from './question-types';
import { submittedRowLabel } from './submitted-row-label';

export type SubmittedResponse = Pick<
  QuestionResponseSnapshot,
  'id' | 'title' | 'sections' | 'questions'
> & {
  respondentName: string | null;
  submittedAt: string;
};

export function exportFileName(value: string) {
  return (
    value
      .normalize('NFC')
      .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_')
      .replace(/[. ]+$/g, '')
      .trim()
      .slice(0, 60) || '제출 응답'
  );
}

export function submittedAnswerText(
  field: QuestionBlockField,
  value: string,
): string {
  if (!value.trim()) return '미응답';
  if (field.kind === 'text') return value;
  if (field.kind === 'scale') {
    const answer = scaleAnswer(value);
    const config = field.scaleConfig ?? {
      max: field.scaleMax ?? 5,
      low: '',
      middle: '',
      high: '',
      allowText: false,
    };
    const label = answer.score === null ? '' : scaleLabel(config, answer.score);
    return [
      answer.score === null
        ? '미응답'
        : `${answer.score}점 / ${config.max}점 만점${label ? ` · ${label}` : ''}`,
      answer.text,
    ]
      .filter(Boolean)
      .join('\n');
  }
  const answer = choiceAnswerValue(value, field.kind === 'multiple');
  return (
    [
      ...answer.choices.map((choice) => {
        const option = field.options?.find(
          (item) => item.id === choiceAnswerId(choice),
        );
        return typeof choice === 'string'
          ? (option?.label ?? '삭제된 선택지')
          : `${option?.label ?? '직접 입력'}: ${choice.text}`;
      }),
      answer.text,
    ]
      .filter(Boolean)
      .join('\n') || '미응답'
  );
}

/** Use submission activity flags, never retained answers from inactive conditions. */
export function submittedResponseSections(submission: SubmittedResponse) {
  const questions = new Map(
    submission.questions.map((question) => [question.questionId, question]),
  );
  return submission.sections.map((section) => ({
    id: section.id,
    title: section.title,
    questions: section.questions.flatMap((placement) => {
      const question = questions.get(
        placement.sourceQuestionId ?? placement.id,
      );
      if (!question || question.definition.purpose === 'study_registration')
        return [];
      const definition = question.definition;
      const active = new Set(question.activeRowIds);
      const flow = definition.answer_layout === 'flow';
      const rows = flow
        ? materializeFlowRows(
            question.rows,
            definition.row_mode === 'repeatable'
              ? (definition.max_rows ?? 1)
              : 1,
          )
        : question.rows;
      return [
        {
          id: placement.id,
          title: definition.title,
          prompt: definition.prompt,
          recommendations: [
            ...(definition.fields.some(
              (field) => field.kind === 'text' && field.explorationRecommended,
            )
              ? ['탐구활동 참조 권장']
              : []),
            ...(definition.fields.some(
              (field) => field.kind === 'text' && field.studyRecommended,
            )
              ? ['학습법 참조 권장']
              : []),
          ],
          rows: rows.flatMap((row, index) =>
            active.has(row.id)
              ? [
                  {
                    id: row.id,
                    label: flow
                      ? flowRowLabel(row, definition.row_labels)
                      : definition.row_mode !== 'single' || rows.length > 1
                        ? submittedRowLabel(
                            row,
                            index,
                            rows.length,
                            definition.row_labels,
                          )
                        : '',
                    fields: definition.fields.map((field) => ({
                      id: field.id,
                      label: field.label,
                      value: submittedAnswerText(
                        field,
                        row.answers[field.id] ?? '',
                      ),
                    })),
                  },
                ]
              : [],
          ),
        },
      ];
    }),
  }));
}

export function submissionDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '제출일 확인 불가'
    : date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

export function submissionFileName(
  submission: SubmittedResponse,
  index: number,
) {
  return `${String(index + 1).padStart(3, '0')}_${exportFileName(submission.respondentName || '이름 없음')}_${exportFileName(submission.title)}.pdf`;
}
