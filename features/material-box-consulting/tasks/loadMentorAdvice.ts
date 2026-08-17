import { mentorAdviceFixtures } from '@/features/material-box-consulting/data/mentorAdviceFixtures';
import type { MentorAdvice } from '@/features/material-box-consulting/model/types';

export function loadMentorAdvice(signal: AbortSignal) {
  return new Promise<Array<MentorAdvice>>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      resolve(mentorAdviceFixtures.map((advice) => ({ ...advice })));
    }, 900);

    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(
          new DOMException('멘토 조언 요청이 취소되었습니다.', 'AbortError'),
        );
      },
      { once: true },
    );
  });
}
