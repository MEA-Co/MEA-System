'use client';

import type { QuestionnaireStartNotice as StartNotice } from '../../lib/questionnaire/types';
import {
  questionPromptClass,
  questionSurfaceClass,
} from '../question/question-styles';
import { RichTextContent } from '../question/RichTextContent';
import { StudyRegistrationAction } from '../question/StudyRegistrationAction';

export function QuestionnaireStartNotice({ notice }: { notice: StartNotice }) {
  return (
    <aside aria-label="질문지 시작 안내" className={questionSurfaceClass}>
      <h3 className={questionPromptClass}>{notice.title}</h3>
      <RichTextContent value={notice.body} />
      <StudyRegistrationAction label={notice.buttonLabel} />
    </aside>
  );
}
