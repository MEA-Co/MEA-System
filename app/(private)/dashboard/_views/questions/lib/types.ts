import type { QuestionDetail } from './question-details';
import type { QuestionKind } from './question-types';

export type ScaleConfig = {
  max: number;
  low: string;
  middle: string;
  high: string;
  allowText: boolean;
};

export type { QuestionDetail } from './question-details';

export type Question = {
  kind?: QuestionKind;
  choiceStyle?: 'list' | 'chip';
  choiceAllowText?: boolean;
  explorationRecommended?: boolean;
  studyRecommended?: boolean;
  options?: { id: string; label: string; isOther?: boolean }[];
  scaleConfig?: ScaleConfig;
  id: string;
  logicalKey: string;
  text: string;
  details: QuestionDetail[];
};
