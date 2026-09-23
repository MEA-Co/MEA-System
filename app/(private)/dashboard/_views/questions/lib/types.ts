import type { QuestionKind } from './question-types';

export type ScaleConfig = {
  max: number;
  low: string;
  middle: string;
  high: string;
  allowText: boolean;
};

export type QuestionDetail = {
  id: string;
  title: string;
  text: string;
  visibleToConsultants: boolean;
};

export type Question = {
  kind?: QuestionKind;
  choiceStyle?: 'list' | 'chip';
  choiceAllowText?: boolean;
  options?: { id: string; label: string; isOther?: boolean }[];
  scaleConfig?: ScaleConfig;
  id: string;
  logicalKey: string;
  text: string;
  details: QuestionDetail[];
};
