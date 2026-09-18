export type AnswerSnapshot = {
  revision: number;
  status: string;
  savedAt: string | null;
  answers: Record<string, string>;
};
export type AnswerSaveRequest = {
  answers: Record<string, string>;
  revision: number;
  saveId: string;
  complete: boolean;
};
/** Request bookkeeping is independent of rendering; uncertain requests stay immutable. */
export class AnswerSessionState {
  revision: number;
  saved: string;
  busy = false;
  blocked = false;
  retry: AnswerSaveRequest | null = null;
  constructor(remote: AnswerSnapshot) {
    this.revision = remote.revision;
    this.saved = JSON.stringify(remote.answers);
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
    this.saved = JSON.stringify(remote.answers);
  }
  begin(
    answers: Record<string, string>,
    complete: boolean,
    makeId: () => string,
  ) {
    if (this.busy || this.blocked) return null;
    this.busy = true;
    this.retry ??= {
      answers: structuredClone(answers),
      revision: this.revision,
      saveId: makeId(),
      complete,
    };
    return this.retry;
  }
  accept(revision: number, request: AnswerSaveRequest) {
    this.revision = revision;
    this.saved = JSON.stringify(request.answers);
    this.retry = null;
  }
}
