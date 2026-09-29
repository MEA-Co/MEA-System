import { Button } from '@/components/ui/button';

import { type Activity, groups } from '../lib/fields';

import { ExplorationFieldIcon } from './ExplorationFieldIcon';
import { ExplorationReportInput } from './ExplorationReportInput';

export function ExplorationActivityDetails({
  activity,
  onClose,
  notice = '다른 작성자의 탐구활동입니다. 읽기 전용으로 표시됩니다.',
}: {
  activity: Activity;
  notice?: string;
  onClose: () => void;
}) {
  return (
    <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pt-4 md:px-6 md:pt-6">
      <p className="text-sm text-muted-foreground">{notice}</p>
      {groups.map((group) => (
        <section key={group.title} className="rounded-2xl border p-5 md:p-6">
          <dl className="grid gap-6 md:grid-cols-2">
            {group.fields.map((field) => (
              <div key={field.key} className="min-w-0">
                <dt className="flex items-center gap-2 font-semibold">
                  <ExplorationFieldIcon
                    field={
                      field.key === 'semester'
                        ? 'grade'
                        : field.key === 'recordArea'
                          ? 'recordType'
                          : field.key
                    }
                  />
                  <span>{field.label}</span>
                </dt>
                <dd className="mt-2 whitespace-pre-wrap wrap-break-word text-sm leading-relaxed">
                  {activity.values[field.key] || '입력하지 않음'}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <ExplorationReportInput
        activityId={activity.clientKey}
        reports={activity.reports ?? []}
        onChange={() => {}}
        readOnly
      />
      <section className="space-y-4 rounded-2xl border p-5 md:p-6">
        <h2 className="font-semibold">참고 자료</h2>
        {activity.values.references.length ? (
          activity.values.references.map((reference) => (
            <dl
              key={reference.clientKey}
              className="space-y-2 whitespace-pre-wrap wrap-break-word text-sm"
            >
              <dt className="font-medium">참고 자료명</dt>
              <dd>{reference.title || '입력하지 않음'}</dd>
              <dt className="font-medium">자료 선정 과정/방법/선택 이유</dt>
              <dd>{reference.selection || '입력하지 않음'}</dd>
              <dt className="font-medium">탐구 내 자료 활용법</dt>
              <dd>{reference.usage || '입력하지 않음'}</dd>
            </dl>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            등록된 참고 자료가 없습니다.
          </p>
        )}
      </section>
      <div className="sticky bottom-0 flex justify-end border-t bg-background py-4">
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  );
}
