import subjects from '@/app/(private)/consulting/subject-selection/_data/subjects.json';

export const SUBJECT_SELECTION_TERMS = [
  { id: 'grade-2-semester-1', label: '2-1' },
  { id: 'grade-2-semester-2', label: '2-2' },
  { id: 'grade-3-semester-1', label: '3-1' },
  { id: 'grade-3-semester-2', label: '3-2' },
] as const;

export const SUBJECT_SELECTION_TYPES = [
  'general',
  'career',
  'convergence',
] as const;

export type SubjectSelectionTermId = (typeof SUBJECT_SELECTION_TERMS)[number]['id'];
export type SubjectSelectionType = (typeof SUBJECT_SELECTION_TYPES)[number];

export type SubjectSelectionCourse = {
  id: string;
  name: string;
  domain: string;
  selectionType: SubjectSelectionType;
  description: string;
  coreArea: string;
};

export const subjectSelectionCourses =
  subjects as ReadonlyArray<SubjectSelectionCourse>;
