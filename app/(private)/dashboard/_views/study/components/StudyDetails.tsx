import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { DetailLabel } from '@/components/ui/detail-label';
import { DetailValue } from '@/components/ui/detail-value';
import {
  groups,
  problemSourceDisplayValue,
  problemSourceOptions,
  type Study,
} from '@/lib/study/fields';

export function StudyDetails({
  study,
  onClose,
  notice = '학습법을 읽기 전용으로 표시합니다.',
  hideEmptyFields = false,
}: {
  study: Study;
  notice?: string;
  hideEmptyFields?: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pt-4 pb-6 md:px-6 md:pt-6">
        {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
        <div className="grid grid-cols-1 items-start lg:items-stretch gap-y-3 lg:grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)] lg:gap-x-2 lg:gap-y-5">
          {groups
            .filter(
              (group) =>
                !hideEmptyFields ||
                group.fields.some((field) => study.values[field.key].trim()),
            )
            .flatMap((group) => [
              <Card
                variant="accent"
                size="sm"
                key={group.title}
                className={`min-w-0 ${group.title === '문제 상황' || group.title === '대응 솔루션' ? '' : 'lg:col-span-3'}`}
              >
                <CardHeader variant="emphasis">
                  <h2 className="font-bold">{group.title}</h2>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
                    {group.fields
                      .filter(
                        (field) =>
                          !hideEmptyFields || study.values[field.key].trim(),
                      )
                      .map((field) => (
                        <div
                          key={field.key}
                          className={`min-w-0 ${field.key === 'category' || field.key === 'subject' ? '' : 'sm:col-span-2'}`}
                        >
                          <DetailLabel>
                            <span>{field.label}</span>
                          </DetailLabel>
                          <DetailValue className="mt-2 break-keep">
                            {field.key === 'checklist' ? (
                              <ul className="list-disc space-y-2 pl-5">
                                {study.values.checklist
                                  .split('\n')
                                  .filter((text) => text.trim())
                                  .map((text, index) => (
                                    <li key={index}>{text}</li>
                                  ))}
                              </ul>
                            ) : field.key === 'practicePeriod' &&
                              !study.values.periodEnabled ? (
                              '기간 설정 없음'
                            ) : (
                              (field.key === 'problemSource'
                                ? problemSourceOptions.find(
                                    (option) =>
                                      option.value ===
                                      problemSourceDisplayValue(
                                        study.values.problemSource,
                                      ),
                                  )?.label
                                : study.values[field.key]) || '입력하지 않음'
                            )}
                          </DetailValue>
                          {field.key === 'problem' &&
                            study.values.problemExperience && (
                              <>
                                <DetailLabel className="mt-5 border-t pt-4">
                                  문제 상황에 대한 구체적인 경험
                                </DetailLabel>
                                <DetailValue className="mt-2 break-keep">
                                  {study.values.problemExperience}
                                </DetailValue>
                              </>
                            )}
                        </div>
                      ))}
                  </dl>
                </CardContent>
              </Card>,
              group.title === '문제 상황' && (
                <span
                  key="problem-solution-arrow"
                  aria-hidden="true"
                  className="flex h-6 items-center justify-center self-center text-muted-foreground"
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
