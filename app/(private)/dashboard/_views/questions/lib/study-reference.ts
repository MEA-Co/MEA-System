import type { Editor } from '@tiptap/core';

import { createReferenceMark, referenceCommand } from './exploration-reference';
export const StudyReference = createReferenceMark(
  'studyReference',
  'data-study-id',
);
export function studyCommand(editor: Editor) {
  return referenceCommand(editor, '공부법');
}
