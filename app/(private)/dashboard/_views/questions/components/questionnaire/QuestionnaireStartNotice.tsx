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

export function QuestionnaireStartNotice({
  notice,
  questionnaireId,
  beforeLinkRegistration,
  registrationDisabled,
}: {
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
