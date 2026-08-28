// User → Agent

export type ConsultingUserAction =
  | { type: 'user.next-explanation' }
  | { type: 'user.previous-explanation' }
  | { type: 'user.start-input' }
  | { type: 'user.review-explanation' }
  | { type: 'user.submit'; value: string }
  | { type: 'user.retry' }
  | { type: 'user.back' }
  | { type: 'user.reset' };
