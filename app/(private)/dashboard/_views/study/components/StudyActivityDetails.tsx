import { Button } from '@/components/ui/button';

import { type Activity, groups, problemSourceOptions } from '../lib/fields';

import { StudyFieldIcon } from './StudyFieldIcon';
import { StudyReportInput } from './StudyReportInput';

export function StudyActivityDetails({
  activity,
  onClose,
  notice = '학습법을 읽기 전용으로 표시합니다.',
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
                  <StudyFieldIcon field={field.key} />
                  <span>{field.label}</span>
                </dt>
                <dd className="mt-2 whitespace-pre-wrap wrap-break-word text-sm leading-relaxed">
                  {(field.key === 'problemSource'
                    ? problemSourceOptions.find(
                        (option) =>
                          option.value === activity.values.problemSource,
                      )?.label
                    : activity.values[field.key]) || '입력하지 않음'}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <StudyReportInput
        activityId={activity.clientKey}
        reports={activity.reports ?? []}
        onChange={() => {}}
        readOnly
      />
      <div className="sticky bottom-0 flex justify-end border-t bg-background py-4">
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  );
}
