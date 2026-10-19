'use client';

import type { QuestionnaireNotice } from '../../lib/questionnaire/types';
import { ExplorationRegistrationAction } from '../question/ExplorationRegistrationAction';
import {
  questionPromptClass,
  questionSurfaceClass,
} from '../question/question-styles';
import { RichTextContent } from '../question/RichTextContent';
import { StudyRegistrationAction } from '../question/StudyRegistrationAction';

import { LinkRegistrationAction } from './LinkRegistrationAction';

export function QuestionnaireStartNotice({
  notice,
  beforeLinkRegistration,
  registrationDisabled,
}: {
  notice: QuestionnaireNotice;
  beforeLinkRegistration?: () => Promise<boolean>;
  registrationDisabled?: boolean;
}) {
  return (
    <aside aria-label="질문지 안내" className={questionSurfaceClass}>
      <h3 className={questionPromptClass}>{notice.title}</h3>
      <RichTextContent value={notice.body} />
      <div className="flex flex-wrap gap-3">
        {notice.buttonLabel && (
          <StudyRegistrationAction label={notice.buttonLabel} />
        )}
        {notice.explorationButtonLabel && (
          <ExplorationRegistrationAction
            label={notice.explorationButtonLabel}
          />
        )}
        {notice.linkButtonLabel && (
          <LinkRegistrationAction
            label={notice.linkButtonLabel}
            beforeNavigate={beforeLinkRegistration}
            disabled={registrationDisabled}
          />
        )}
      </div>
    </aside>
  );
}
