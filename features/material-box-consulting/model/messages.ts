import type { ConsultingMessage } from '@/features/consulting/ui/message';

export const introMessage: ConsultingMessage = [
  {
    text: '앞서 여러분은 생활기록부 브랜딩이란 무엇이며, 브랜딩을 하기 위해서 ',
  },
  { text: '재료함', emphasis: 'accent' },
  { text: '이라는 것이 필요하다는 걸 확인했어요.' },
];

export const startMessage: ConsultingMessage = [
  { text: '이제 본격적으로 ' },
  { text: '재료함', emphasis: 'accent' },
  { text: '을 만들어봅시다!' },
];

export const majorInputMessage =
  '희망 전공이 하나가 아닐 수도 있습니다. 그 희망전공들에서 여러분만의 스토리가 드러나요. 희망 전공이 여러개라면, 가장 가고 싶은 학과를 3개까지 써주세요.';

export const majorReviewMessage =
  '잘 작성했나요? 희망 전공은 나중에 얼마든지 달라질 수 있습니다. 희망 전공이 달라지면 어떻게 해야하는지는 나중에 알려드릴게요.';

export const keywordIntroMessage: ConsultingMessage = [
  {
    text: '좋습니다! 그런데 전공은 사실 아주 광범위한 내용을 다룬답니다. 여러분이 여러분만의 서사를 담아내려면, 전공 별로 ',
  },
  { text: "'세부 키워드'", emphasis: 'strong' },
  { text: '를 선택해야 해요.' },
];

export const keywordInterestMessage =
  '이미 여러분만의 관심사가 있을 수도 있고, 조금만 생각해보면 관심 가는 분야가 나올 수도 있어요.';
