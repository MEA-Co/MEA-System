'use client';
import { ImageGallery } from '@/components/ui/image-gallery';
import { noticeImageUrl } from '@/lib/questionnaire-notice-images/model';

import type { QuestionnaireNotice } from '../../lib/questionnaire/types';
import { ExplorationRegistrationAction } from '../question/ExplorationRegistrationAction';
import {
  questionPromptClass,
  questionSurfaceClass,
} from '../question/question-styles';
import { RichTextContent } from '../question/RichTextContent';
import { StudyRegistrationAction } from '../question/StudyRegistrationAction';

import { LinkRegistrationAction } from './LinkRegistrationAction';
import { SubmissionReferencePanel } from './SubmissionReferencePanel';

export function QuestionnaireStartNotice({
  sessionId,
  notice,
  questionnaireId,
  beforeLinkRegistration,
  registrationDisabled,
}: {
  sessionId?: string;
  notice: QuestionnaireNotice;
  questionnaireId?: string;
  beforeLinkRegistration?: () => Promise<boolean>;
  registrationDisabled?: boolean;
}) {
  return (
    <aside aria-label="질문지 안내" className={questionSurfaceClass}>
      <h3 className={questionPromptClass}>{notice.title}</h3>
      <RichTextContent value={notice.body} />
      {questionnaireId && !!notice.images?.length && (
        <ImageGallery
          label="안내 사진"
          images={notice.images.map((image) => ({
            id: image.id,
            src: noticeImageUrl(questionnaireId, notice.id, image.id),
            alt: image.name,
          }))}
        />
      )}
      {notice.submissionReference && (
        <SubmissionReferencePanel
          questionnaireId={questionnaireId}
          sessionId={sessionId}
          noticeId={notice.id}
          selection={notice.submissionReference}
        />
      )}
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
