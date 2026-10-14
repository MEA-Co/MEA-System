import type { Exploration } from '@/lib/exploration/fields';

export function explorationTitle(activity: Exploration) {
  return (
    activity.values.topic.trim() ||
    activity.values.recordArea.trim() ||
    '탐구활동'
  );
}
export function explorationSummary(activity: Exploration) {
  const values = activity.values;
  return (
    [
      values.grade && `${values.grade}학년`,
      values.semester && `${values.semester}학기`,
      values.recordType,
      values.recordArea,
    ]
      .filter(Boolean)
      .join(' · ') || '기재 영역 미입력'
  );
}
