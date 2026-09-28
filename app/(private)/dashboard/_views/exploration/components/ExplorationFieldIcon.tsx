import {
  BookOpen,
  ChartNoAxesColumnIncreasing,
  ClipboardList,
  FileText,
  FlaskConical,
  GraduationCap,
  Layers,
  Lightbulb,
  ListChecks,
  Paperclip,
  Presentation,
  School,
  Sprout,
  Target,
} from 'lucide-react';

const icons = {
  grade: GraduationCap,
  recordType: Layers,
  schoolContext: School,
  topic: Lightbulb,
  record: FileText,
  competencies: Target,
  process: ChartNoAxesColumnIncreasing,
  motivation: ClipboardList,
  story: FlaskConical,
  result: Presentation,
  followup: Sprout,
  report: FileText,
  references: Paperclip,
  title: BookOpen,
  selection: ListChecks,
  usage: BookOpen,
};

export function ExplorationFieldIcon({ field }: { field: keyof typeof icons }) {
  const Icon = icons[field];
  return (
    <Icon
      aria-hidden="true"
      className="size-4 shrink-0 text-muted-foreground"
    />
  );
}
