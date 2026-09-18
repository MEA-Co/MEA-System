export type SchoolCourseRequirement = {
  id: string;
  label: string;
  domains: string[];
  grade: number | null;
  semester: number | null;
  minimumCourses: number;
  rule: string;
};

function ruleDomains(rule: string) {
  const match = rule.match(/^\s*\(([^)]+)\)/);
  if (!match) return [];
  return match[1]
    .split(/[,·/]/)
    .map((domain) => domain.replaceAll(/교과|군|영역/g, '').trim())
    .filter(Boolean);
}

function requirementLabel(
  domains: string[],
  grade: number | null,
  semester: number | null,
) {
  const domainLabel = domains.join('·') || '학교 지정';
  return grade && semester ? `${domainLabel} · ${grade}-${semester}` : domainLabel;
}

export function schoolCourseRequirements(linkedRules: readonly string[]) {
  const requirements: SchoolCourseRequirement[] = [];
  for (const rule of linkedRules) {
    const domains = ruleDomains(rule);
    if (!domains.length) continue;
    const termPattern = /(\d)학년\s*(\d)학기에?\s*(\d+)\s*개(?:\s*과목)?\s*이상\s*선택/g;
    for (const match of rule.matchAll(termPattern)) {
      const grade = Number(match[1]);
      const semester = Number(match[2]);
      const minimumCourses = Number(match[3]);
      requirements.push({
        id: `school-${requirements.length + 1}`,
        label: requirementLabel(domains, grade, semester),
        domains,
        grade,
        semester,
        minimumCourses,
        rule,
      });
    }
    if (!/(?:2\s*,\s*3|2·3)학년/.test(rule)) continue;
    const totalMatch = rule.match(
      /과목(?:을)?\s*(\d+)\s*개(?:\s*과목)?\s*이상\s*선택/,
    );
    if (!totalMatch) continue;
    requirements.push({
      id: `school-${requirements.length + 1}`,
      label: requirementLabel(domains, null, null),
      domains,
      grade: null,
      semester: null,
      minimumCourses: Number(totalMatch[1]),
      rule,
    });
  }
  return requirements;
}

function normalized(value: string) {
  return value.replaceAll(/\s+/g, '').toLowerCase();
}

export function courseMatchesSchoolRequirement(
  course: { name: string; domain: string | null },
  requirement: SchoolCourseRequirement,
) {
  const source = normalized(`${course.domain ?? ''} ${course.name}`);
  return requirement.domains.some((domain) => {
    const normalizedDomain = normalized(domain);
    if (normalizedDomain === '정보')
      return /정보|인공지능|소프트웨어|데이터|프로그래밍/.test(source);
    return source.includes(normalizedDomain);
  });
}
