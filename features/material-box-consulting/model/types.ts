import type {
  ConsultingPrompterPlacement,
  ConsultingPrompterSize,
} from '@/features/consulting/ui/ConsultingMain';
import type { ConsultingMessage } from '@/features/consulting/ui/message';

export type MajorPreference = {
  major: string;
};

export type MentorAdviceQuestion = 'mentor-interests' | 'keyword-help';

export type MentorAdvice = {
  id: string;
  question: MentorAdviceQuestion;
  mentorName: string;
  mentorMajor: string;
  message: string;
  keyword: string;
};

export type MaterialBoxMemory = {
  majorPreferences: Array<MajorPreference>;
  keyword: string;
  careerIdentity: string;
  coreValue: string;
  fieldStrength: string;
  personalStrength: string;
};

export type MaterialBoxTaskOutputs = {
  mentorAdvice: Array<MentorAdvice>;
};

export type MajorPreferenceScreen =
  'major-one' | 'three-majors' | 'major-input';

export type MaterialReflectionScreen =
  | 'career-identity-input'
  | 'core-value-input'
  | 'field-strength-input'
  | 'personal-strength-input';

export type MaterialBoxScreen =
  | MajorPreferenceScreen
  | MaterialReflectionScreen
  | 'keyword-examples'
  | 'keyword-exploration';

export type MaterialBoxView = {
  message: ConsultingMessage | null;
  prompterPlacement: ConsultingPrompterPlacement;
  prompterSize: ConsultingPrompterSize;
  screen: MaterialBoxScreen | null;
};

export type MaterialBoxInteraction =
  | { kind: 'continue' }
  | { kind: 'major-form' }
  | { kind: 'major-review' }
  | { kind: 'keyword-form' }
  | { kind: 'reflection-form' }
  | { kind: 'complete' };

export type MaterialBoxEvent =
  | { type: 'CONTINUE' }
  | {
      type: 'SUBMIT_MAJORS';
      preferences: Array<MajorPreference>;
    }
  | { type: 'EDIT_MAJORS' }
  | { type: 'CONFIRM_MAJORS' }
  | { type: 'SUBMIT_KEYWORD'; keyword: string }
  | { type: 'SUBMIT_CAREER_IDENTITY'; careerIdentity: string }
  | { type: 'SUBMIT_CORE_VALUE'; coreValue: string }
  | { type: 'SUBMIT_FIELD_STRENGTH'; fieldStrength: string }
  | { type: 'SUBMIT_PERSONAL_STRENGTH'; personalStrength: string };
