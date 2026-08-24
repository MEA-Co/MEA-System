import type { StudyRoutineTools } from '@/features/guided-consulting/examples/study-routine/types';

function wait(duration: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, duration);

    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('요청이 취소되었습니다.', 'AbortError'));
      },
      { once: true },
    );
  });
}

export const studyRoutineTools: StudyRoutineTools = {
  async suggestRoutine({ goal, availableTime }, { signal }) {
    await wait(1_100, signal);

    return `${availableTime} 안에서 ‘${goal}’에 집중할 수 있도록, 시작 5분은 지난 내용을 복습하고 이후에는 한 가지 과제에 집중하는 루틴`;
  },
};
