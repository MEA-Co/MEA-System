import type {
  QuestionnaireDocument,
  SaveQuestionnaireRequest,
  SaveQuestionnaireResult,
} from './types';

// Retain an uncertain request verbatim: the DB can recognize a committed retry.
export class QuestionnaireSaveSession {
  revision: number;
  savedDocument: string;
  pending = false;
  blocked = false;
  private retry: SaveQuestionnaireRequest | null = null;

  constructor(document: QuestionnaireDocument, revision: number) {
    this.revision = revision;
    this.savedDocument = JSON.stringify(document);
  }

  async save(
    document: QuestionnaireDocument,
    send: (
      request: SaveQuestionnaireRequest,
    ) => Promise<SaveQuestionnaireResult>,
    makeId: () => string,
  ): Promise<SaveQuestionnaireResult | null> {
    if (this.pending || this.blocked) return null;
    this.pending = true;
    const request = this.retry ?? {
      document: structuredClone(document),
      expectedRevision: this.revision,
      saveId: makeId(),
    };
    this.retry = request;
    try {
      const result = await send(request);
      if (result.ok) {
        this.revision = result.revision;
        this.savedDocument = JSON.stringify(request.document);
        this.retry = null;
      } else if (result.code !== 'unavailable') {
        this.retry = null;
        this.blocked =
          result.code === 'conflict' || result.code === 'forbidden';
      }
      return result;
    } finally {
      this.pending = false;
    }
  }

  block() {
    this.blocked = true;
  }

  reconcileRemote(
    document: QuestionnaireDocument,
    revision: number,
    local: QuestionnaireDocument,
  ) {
    if (revision <= this.revision || this.pending || this.blocked)
      return 'unchanged';
    if (this.hasChanges(local)) {
      this.blocked = true;
      return 'conflict';
    }
    this.revision = revision;
    this.savedDocument = JSON.stringify(document);
    return 'applied';
  }

  hasChanges(document: QuestionnaireDocument) {
    return (
      this.retry !== null || this.savedDocument !== JSON.stringify(document)
    );
  }
}
