export type AnswerSnapshot = {
  revision: number;
  status: string;
  savedAt: string | null;
  answers: Record<string, string>;
  freeResponse?: string;
};
export type AnswerSaveRequest = {
  answers: Record<string, string>;
  freeResponse?: string;
  revision: number;
  saveId: string;
  complete: boolean;
};
/** Request bookkeeping is independent of rendering; uncertain requests stay immutable. */
export function answerContentKey(
  answers: Record<string, string>,
  freeResponse = '',
) {
  return JSON.stringify({ answers, freeResponse });
}
export class AnswerSessionState {
  revision: number;
  saved: string;
  busy = false;
  blocked = false;
  retry: AnswerSaveRequest | null = null;
  constructor(remote: AnswerSnapshot) {
    this.revision = remote.revision;
    this.saved = answerContentKey(remote.answers, remote.freeResponse);
  }
  block() {
    this.blocked = true;
  }
  clearRetry() {
    this.retry = null;
  }
  finish() {
    this.busy = false;
  }
  acceptRemote(remote: AnswerSnapshot) {
    this.revision = remote.revision;
    this.saved = answerContentKey(remote.answers, remote.freeResponse);
  }
  begin(
    answers: Record<string, string>,
    complete: boolean,
    makeId: () => string,
    freeResponse = '',
  ) {
    if (this.busy || this.blocked) return null;
    this.busy = true;
    this.retry ??= {
      answers: structuredClone(answers),
      freeResponse,
      revision: this.revision,
      saveId: makeId(),
      complete,
    };
    return this.retry;
  }
  accept(revision: number, request: AnswerSaveRequest) {
    this.revision = revision;
    this.saved = answerContentKey(request.answers, request.freeResponse);
    this.retry = null;
  }
}
