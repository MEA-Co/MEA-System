import { Button } from '@/components/ui/button';

import {
  type Activity,
  groups,
  problemSourceDisplayValue,
  problemSourceOptions,
} from '../lib/fields';

import { StudyFieldIcon } from './StudyFieldIcon';

export function StudyActivityDetails({
  activity,
  onClose,
  notice = '학습법을 읽기 전용으로 표시합니다.',
  hideEmptyFields = false,
}: {
  activity: Activity;
  notice?: string;
  hideEmptyFields?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pt-4 pb-6 md:px-6 md:pt-6">
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
        <div className="grid grid-cols-1 items-stretch gap-y-3 lg:grid-cols-[minmax(0,2fr)_1.5rem_minmax(0,3fr)] lg:gap-x-2 lg:gap-y-5">
          {groups
            .filter(
              (group) =>
                !hideEmptyFields ||
                group.fields.some((field) => activity.values[field.key].trim()),
            )
            .flatMap((group) => [
              <section
                key={group.title}
                className={`min-w-0 rounded-2xl border p-5 md:p-6 ${group.title === '문제 상황' || group.title === '대응 솔루션' ? '' : 'lg:col-span-3'}`}
              >
                <h2 className="mb-5 font-semibold">{group.title}</h2>
                <dl className="flex flex-wrap gap-x-6 gap-y-5">
                  {group.fields
                    .filter(
                      (field) =>
                        !hideEmptyFields || activity.values[field.key].trim(),
                    )
                    .map((field) => (
                      <div
                        key={field.key}
                        className={`min-w-0 ${field.key === 'category' || field.key === 'subject' || field.key === 'customSubject' ? 'max-w-full flex-none' : 'w-full'}`}
                      >
                        <dt
                          className={`flex items-start gap-2 text-sm font-medium text-muted-foreground ${field.key === 'category' || field.key === 'subject' || field.key === 'customSubject' ? 'whitespace-nowrap' : ''}`}
                        >
                          <StudyFieldIcon field={field.key} />
                          <span>{field.label}</span>
                        </dt>
                        <dd className="mt-2 whitespace-pre-wrap wrap-break-word break-keep text-sm leading-relaxed">
                          {field.key === 'checklist' ? (
                            <ul className="list-disc space-y-2 pl-5">
                              {activity.values.checklist
                                .split('\n')
                                .filter((text) => text.trim())
                                .map((text, index) => (
                                  <li key={index}>{text}</li>
                                ))}
                            </ul>
                          ) : field.key === 'practicePeriod' &&
                            !activity.values.periodEnabled ? (
                            '기간 설정 없음'
                          ) : (
                            (field.key === 'problemSource'
                              ? problemSourceOptions.find(
                                  (option) =>
                                    option.value ===
                                    problemSourceDisplayValue(
                                      activity.values.problemSource,
                                    ),
                                )?.label
                              : activity.values[field.key]) || '입력하지 않음'
                          )}
                        </dd>
                        {field.key === 'problem' &&
                          activity.values.problemExperience && (
                            <>
                              <dt className="mt-5 border-t pt-4 text-sm font-medium text-muted-foreground">
                                문제 상황에 대한 구체적인 경험
                              </dt>
                              <dd className="mt-2 whitespace-pre-wrap wrap-break-word break-keep text-sm leading-relaxed">
                                {activity.values.problemExperience}
                              </dd>
                            </>
                          )}
                      </div>
                    ))}
                </dl>
              </section>,
              group.title === '문제 상황' && (
                <span
                  key="problem-solution-arrow"
                  aria-hidden="true"
                  className="flex h-6 items-center justify-center self-center text-gray-400"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-5 rotate-90 lg:rotate-0"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              ),
            ])}
        </div>
      </div>
      <div className="flex shrink-0 justify-end border-t bg-background px-4 py-3 md:px-6">
        <Button type="button" variant="outline" onClick={onClose}>
          닫기
        </Button>
      </div>
    </div>
  );
}
