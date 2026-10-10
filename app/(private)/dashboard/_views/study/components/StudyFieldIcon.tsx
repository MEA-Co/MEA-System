import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Lightbulb,
  ListChecks,
  Paperclip,
  Target,
  TrendingUp,
} from 'lucide-react';
const icons = {
  category: GraduationCap,
  subject: BookOpen,
  customSubject: BookOpen,
  problem: Target,
  problemSource: Target,
  strategy: Lightbulb,
  practiceGuide: ListChecks,
  practicePeriod: CalendarDays,
  checklist: ClipboardCheck,
  followup: TrendingUp,
  resultDiagnosis: TrendingUp,
  report: FileText,
  references: Paperclip,
  title: BookOpen,
  selection: ListChecks,
  usage: BookOpen,
};
export function StudyFieldIcon({ field }: { field: keyof typeof icons }) {
  const Icon = icons[field];
  return (
    <Icon
      aria-hidden="true"
      className="size-4 shrink-0 text-muted-foreground"
    />
  );
}
