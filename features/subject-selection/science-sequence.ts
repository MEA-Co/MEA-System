import { normalizeCourseName } from './recommendations';

// MEA guidance for the eight 2022-curriculum science electives, not admission eligibility.
const sequences = [
  {
    basic: '물리학',
    advanced: ['역학과 에너지', '역학적 에너지', '전자기와 양자'],
  },
  { basic: '화학', advanced: ['물질과 에너지', '화학 반응의 세계'] },
  { basic: '생명과학', advanced: ['세포와 물질대사', '생물의 유전'] },
  { basic: '지구과학', advanced: ['지구시스템과학', '행성우주과학'] },
];

export function scienceAreaForCourse(name: string) {
  const normalized = normalizeCourseName(name);
  return (
    sequences.find((sequence) =>
      [sequence.basic, ...sequence.advanced].some(
        (candidate) => normalizeCourseName(candidate) === normalized,
      ),
    ) ?? null
  );
}

export function scienceAdvancedForAreas(names: readonly string[]) {
  return [
    ...new Set(
      names.flatMap((name) => scienceAreaForCourse(name)?.advanced ?? []),
    ),
  ];
}

export function scienceSequenceGaps(courses: readonly { name: string }[]) {
  const names = new Set(
    courses.map((course) => normalizeCourseName(course.name)),
  );
  return sequences.flatMap(({ basic, advanced }) =>
    names.has(normalizeCourseName(basic))
      ? []
      : advanced
          .filter((name) => names.has(normalizeCourseName(name)))
          .map((name) => ({ basic, advanced: name })),
  );
}

export function scienceSequenceMessage(
  gaps: ReturnType<typeof scienceSequenceGaps>,
) {
  return gaps
    .map(
      ({ basic, advanced }) =>
        `${advanced}의 기초 과목인 ${basic}이 이수·선택 내역에 없어요.`,
    )
    .join(' ');
}
