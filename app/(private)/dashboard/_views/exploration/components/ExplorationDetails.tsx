import { ArrowRight } from 'lucide-react';
import { Fragment } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DetailLabel } from '@/components/ui/detail-label';
import { DetailValue } from '@/components/ui/detail-value';
import { type Exploration, groups } from '@/lib/exploration/fields';

import { ExplorationReportInput } from './ExplorationReportInput';
import { ExplorationSectionCard } from './ExplorationSectionCard';

export function ExplorationDetails({
  activity,
  onClose,
  notice = '탐구활동을 읽기 전용으로 표시합니다.',
}: {
  activity: Exploration;
  notice?: string;
  onClose: () => void;
}) {
  const { values } = activity;
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-background px-4 pt-4 md:px-6 md:pt-5">
      <p className="text-sm text-muted-foreground">{notice}</p>
      {groups.map((group, index) => {
        const process = 'columns' in group;
        return (
          <ExplorationSectionCard
            key={group.title}
            title={group.title}
            index={index}
          >
            <div
              className={
                process
                  ? 'grid gap-3 lg:grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)_1rem_minmax(0,1fr)]'
                  : 'grid gap-x-5 gap-y-5 md:grid-cols-2'
              }
            >
              {group.fields.map((field, fieldIndex) => {
                if (field.key === 'semester' || field.key === 'recordArea')
                  return null;
                const fullWidth =
                  'fullWidth' in field
                    ? field.fullWidth
                    : 'multiline' in field && field.multiline;
                const label =
                  field.key === 'grade'
                    ? '기재 영역 · 학년 및 학기'
                    : field.label;
                const content =
                  field.key === 'grade'
                    ? [
                        values.grade ? `${values.grade}학년` : '',
                        values.semester ? `${values.semester}학기` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : field.key === 'recordType'
                      ? [values.recordType, values.recordArea]
                          .filter(Boolean)
                          .join(' · ')
                      : values[field.key];
                return (
                  <Fragment key={field.key}>
                    {process && fieldIndex > 0 && (
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 rotate-90 place-self-center text-muted-foreground lg:row-span-2 lg:rotate-0"
                      />
                    )}
                    <dl
                      className={
                        process
                          ? 'grid min-w-0 gap-2 lg:row-span-2 lg:grid-rows-subgrid'
                          : `min-w-0 space-y-2 ${fullWidth ? 'md:col-span-2' : ''}`
                      }
                    >
                      <DetailLabel>{label}</DetailLabel>
                      <DetailValue>
                        {content || (
                          <span className="text-muted-foreground">
                            입력하지 않음
                          </span>
                        )}
                      </DetailValue>
                    </dl>
                  </Fragment>
                );
              })}
            </div>
          </ExplorationSectionCard>
        );
      })}
      <ExplorationReportInput
        activityId={activity.clientKey}
        reports={activity.reports ?? []}
        onChange={() => {}}
        readOnly
      />
      <Card variant="accent" size="sm">
        <CardHeader variant="emphasis">
          <h2 className="text-base font-semibold">참고 자료</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {values.references.length ? (
            values.references.map((reference, index) => (
              <div
                key={reference.clientKey}
                className="min-w-0 space-y-4 rounded-md border p-4"
              >
                <h3 className="text-sm font-medium">참고자료 {index + 1}</h3>
                <div className="grid gap-4 lg:grid-cols-3">
                  {(
                    [
                      ['title', '참고 자료명'],
                      ['selection', '자료 선정 과정/방법/선택 이유'],
                      ['usage', '탐구 내 자료 활용법'],
                    ] as const
                  ).map(([key, label]) => (
                    <dl key={key} className="min-w-0 space-y-2">
                      <DetailLabel>{label}</DetailLabel>
                      <DetailValue>
                        {reference[key] || (
                          <span className="text-muted-foreground">
                            입력하지 않음
                          </span>
                        )}
                      </DetailValue>
                    </dl>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              등록된 참고 자료가 없습니다.
            </p>
          )}
        </CardContent>
      </Card>
      <div className="sticky bottom-0 z-10 -mx-4 flex justify-end border-t bg-background px-4 py-3 md:-mx-6 md:px-6">
        <Button type="button" variant="outline" onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  );
}
