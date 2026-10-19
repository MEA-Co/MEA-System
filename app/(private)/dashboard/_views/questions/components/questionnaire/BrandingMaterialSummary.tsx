'use client';

import { Fragment } from 'react';

import type { PreviewAnswerRow } from '../../lib/reference-rows';
import { QuestionRichTextEditor } from '../question/QuestionRichTextEditor';

import { RichTextContent } from './RichTextContent';

export const BRANDING_QUESTIONNAIRE_ID = '01832b27-3408-409d-a635-bd4a913562f2';
export const MATERIAL_TABLES = [
  {
    title: '고등학생 때의 재료함',
    items: [
      {
        label: '전공 세부 분야 키워드',
        question: '59eac053-2376-4d8f-9537-f2bbcd124a42',
        field: '413428a8-91dd-484f-9b2d-442049e4bb3a',
      },
      {
        label: '전공 가치관',
        question: '6b7457f4-c6b6-4031-a28a-c54a7e8048f3',
        field: '5bedc955-80c5-4a8b-906b-c2598c34a315',
      },
      {
        label: '계열 적합 역량',
        question: '5d604e15-5b52-4281-842d-0eb5293d74d0',
        field: '266949d6-fd95-4c17-875b-a596c6df86db',
      },
    ],
  },
  {
    title: '대학 진학 후의 신규 재료함',
    items: [
      {
        label: '전공 세부 분야 키워드',
        question: 'b93ab076-9f3c-48f9-9251-1b6717ec648c',
        field: '65923a77-7bda-45b4-b4a5-3c31ead386f0',
      },
      {
        label: '전공 가치관',
        question: 'f104e5a0-e4f2-4b09-8899-fcf7cb8c4b9a',
        field: '6516858c-a60d-43b7-a19a-da00dd9d29b8',
      },
      {
        label: '계열 적합 역량',
        question: '8269666e-97b1-472e-b5bd-0658d78b4fda',
        field: '8df1299c-ccab-44f2-9bfe-fc99dcbdea42',
      },
    ],
  },
];

export function BrandingMaterialSummary({
  rows,
  availableIds,
  disabled,
  onChange,
}: {
  rows: Record<string, PreviewAnswerRow[]>;
  availableIds: Set<string>;
  disabled: boolean;
  onChange: (id: string, rows: PreviewAnswerRow[]) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-2 md:grid-rows-[repeat(7,auto)] md:gap-y-0">
      {MATERIAL_TABLES.map((table) => (
        <section key={table.title} className="grid min-w-0 md:row-span-7 md:grid-rows-subgrid">
          <h3 className="mb-3 text-xl font-bold">{table.title}</h3>
          <table className="grid w-full min-w-0 text-sm md:row-span-6 md:grid-rows-subgrid">
            <caption className="sr-only">{table.title} 답변 모아보기</caption>
            <tbody className="contents">
              {table.items.map((item) => {
                const entries = rows[item.question]?.length
                  ? rows[item.question]
                  : [{ id: 1, answers: {} }];
                return (
                  <Fragment key={item.question}>
                    <tr className="contents">
                      <th
                        scope="rowgroup"
                        className="-mt-px border border-border bg-brand/15 px-4 py-3 text-left font-semibold text-foreground"
                      >
                        {item.label}
                      </th>
                    </tr>
                    <tr className="contents">
                      <td className="-mt-px min-w-0 space-y-2 border border-border bg-background p-3 sm:p-4">
                        {!availableIds.has(item.question) ? (
                          <p className="text-muted-foreground">
                            연결된 질문을 불러올 수 없어요.
                          </p>
                        ) : (
                          entries.map((row, index) => (
                            <div
                              key={row.id}
                              className="flex items-start gap-2"
                            >
                              <span className="pt-2 text-muted-foreground">
                                {index + 1}.
                              </span>
                              <div className="min-w-0 flex-1">
                                {disabled ? (
                                  <RichTextContent
                                    value={
                                      row.answers[item.field] ||
                                      '아직 작성한 내용이 없어요.'
                                    }
                                  />
                                ) : (
                                  <QuestionRichTextEditor
                                    id={`material-${item.question}-${row.id}`}
                                    ariaLabel={`${table.title} · ${item.label} ${index + 1}`}
                                    value={row.answers[item.field] ?? ''}
                                    compact
                                    placeholder={`${item.label}을 작성해 주세요`}
                                    onChange={(value) =>
                                      onChange(
                                        item.question,
                                        entries.map((entry) =>
                                          entry.id === row.id
                                            ? {
                                                ...entry,
                                                answers: {
                                                  ...entry.answers,
                                                  [item.field]: value,
                                                },
                                              }
                                            : entry,
                                        ),
                                      )
                                    }
                                  />
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
