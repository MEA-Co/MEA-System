export type PriorityProfileId =
  | 'math'
  | 'math-computing'
  | 'physics-chemistry'
  | 'physics-earth'
  | 'physics-chemistry-combined'
  | 'physics-earth-combined'
  | 'chemistry-biology'
  | 'chemistry'
  | 'biology'
  | 'earth'
  | 'language'
  | 'history'
  | 'philosophy'
  | 'politics-law'
  | 'economics'
  | 'business-global'
  | 'sociology'
  | 'psychology'
  | 'media';

export type PriorityProfile = {
  id: PriorityProfileId;
  label: string;
  departments: string[];
  core: string[];
  subCore: string[];
  recommendCourses?: string[];
  recommendDomains: string[];
};

export type RecommendationRule = {
  category: 'core' | 'recommended';
  courses?: string[];
  domain?: string;
  selectionType?: 'general' | 'career' | 'convergence';
  choose?: number;
  requiredCourses?: string[];
  note: string;
};

export type UniversityRecommendation = {
  university: '고려대' | '연세대' | '경희대' | '중앙대';
  departments: string[];
  matchTerms?: string[];
  profileIds: PriorityProfileId[];
  rules: RecommendationRule[];
};

export type UniversityMatch = UniversityRecommendation & {
  matchedDepartment: string;
  score: number;
};

export const PRIORITY_PROFILES: PriorityProfile[] = [
  {
    id: 'math',
    label: '수학형',
    departments: ['수학과', '응용수학과', '수학교육과'],
    core: ['미적분 II', '기하'],
    subCore: ['수학', '정보'],
    recommendCourses: ['경제수학', '직무 수학'],
    recommendDomains: ['과학'],
  },
  {
    id: 'math-computing',
    label: '수학·정보형',
    departments: [
      '통계학과',
      '컴퓨터공학과',
      '컴퓨터과학과',
      '소프트웨어학과',
      '데이터과학과',
      '인공지능학과',
      '정보보안학과',
    ],
    core: ['미적분 II', '기하', '정보'],
    subCore: ['인공지능 수학', '데이터 과학', '인공지능 기초'],
    recommendDomains: ['과학'],
  },
  {
    id: 'physics-chemistry',
    label: '물리형(화학)',
    departments: [
      '물리학과',
      '전기전자공학과',
      '전자공학과',
      '반도체공학과',
      '기계공학과',
      '항공우주공학과',
    ],
    core: ['미적분 II', '기하', '물리학'],
    subCore: ['화학'],
    recommendDomains: ['과학', '수학', '정보'],
  },
  {
    id: 'physics-earth',
    label: '물리형(지구)',
    departments: [
      '건축학과',
      '건축공학과',
      '토목공학과',
      '조선해양공학과',
      '사회환경공학과',
    ],
    core: ['미적분 II', '기하', '물리학'],
    subCore: ['지구과학'],
    recommendDomains: ['과학', '수학', '정보'],
  },
  {
    id: 'physics-chemistry-combined',
    label: '물리·화학형',
    departments: [
      '화학공학과',
      '에너지공학과',
      '원자력공학과',
      '신소재공학과',
      '재료공학과',
    ],
    core: ['미적분 II', '기하', '물리학', '화학'],
    subCore: [],
    recommendDomains: ['과학', '수학', '정보'],
  },
  {
    id: 'physics-earth-combined',
    label: '물리·지구형',
    departments: ['천문학과', '우주과학과', '도시공학과', '건설환경공학과'],
    core: ['미적분 II', '기하', '물리학', '지구과학'],
    subCore: [],
    recommendDomains: ['과학', '수학', '정보'],
  },
  {
    id: 'chemistry-biology',
    label: '화학·생물형',
    departments: [
      '화학생명공학과',
      '생명공학과',
      '의학과',
      '의예과',
      '치의예과',
      '한의예과',
      '약학과',
      '환경공학과',
      '식품공학과',
      '간호학과',
    ],
    core: ['미적분 II', '화학', '생명과학'],
    subCore: ['기하'],
    recommendDomains: ['과학', '수학'],
  },
  {
    id: 'chemistry',
    label: '화학형',
    departments: ['화학과', '응용화학과'],
    core: ['미적분 II', '화학'],
    subCore: ['기하', '물리학', '생명과학'],
    recommendDomains: ['과학', '수학'],
  },
  {
    id: 'biology',
    label: '생물형',
    departments: ['생물학과', '생명과학과', '생화학과'],
    core: ['미적분 II', '생명과학'],
    subCore: ['기하', '화학'],
    recommendDomains: ['과학', '수학'],
  },
  {
    id: 'earth',
    label: '지구형',
    departments: ['지구과학과', '지질학과', '대기과학과', '지리학과'],
    core: ['미적분 II', '기하', '지구과학'],
    subCore: ['물리학'],
    recommendDomains: ['과학', '수학'],
  },
  {
    id: 'language',
    label: '어문계열',
    departments: [
      '국어국문학과',
      '영어영문학과',
      '불어불문학과',
      '독어독문학과',
      '중어중문학과',
      '일어일문학과',
      '어문학과',
    ],
    core: ['주제 탐구 독서'],
    subCore: ['독서 토론과 글쓰기', '영미 문학 읽기'],
    recommendDomains: ['국어', '영어', '사회', '제2외국어'],
  },
  {
    id: 'history',
    label: '사학과',
    departments: ['사학과', '역사학과', '국사학과'],
    core: ['세계사', '동아시아 역사 기행'],
    subCore: ['역사로 탐구하는 현대 세계'],
    recommendDomains: ['사회'],
  },
  {
    id: 'philosophy',
    label: '철학과',
    departments: ['철학과', '윤리교육과'],
    core: ['현대사회와 윤리', '윤리와 사상'],
    subCore: ['인문학과 윤리', '윤리문제 탐구', '인간과 철학', '논리와 사고'],
    recommendDomains: ['사회'],
  },
  {
    id: 'politics-law',
    label: '정치·행정·법',
    departments: ['정치외교학과', '행정학과', '법학과', '정치학과'],
    core: ['정치', '법과 사회'],
    subCore: ['현대사회와 윤리', '사회와 문화', '윤리와 사상'],
    recommendDomains: ['사회'],
  },
  {
    id: 'economics',
    label: '경제',
    departments: ['경제학과', '경제금융학과'],
    core: ['경제', '경제수학'],
    subCore: ['금융과 경제생활'],
    recommendDomains: ['사회', '수학'],
  },
  {
    id: 'business-global',
    label: '경영·무역·국제',
    departments: ['경영학과', '무역학과', '국제학과', '국제통상학과'],
    core: ['경제', '경제수학'],
    subCore: ['세계시민과 지리', '국제 관계의 이해', '금융과 경제생활'],
    recommendDomains: ['사회', '수학'],
  },
  {
    id: 'sociology',
    label: '사회학',
    departments: ['사회학과', '사회복지학과'],
    core: ['사회와 문화'],
    subCore: ['사회문제 탐구'],
    recommendDomains: ['사회'],
  },
  {
    id: 'psychology',
    label: '심리학',
    departments: ['심리학과', '상담심리학과'],
    core: ['사회와 문화'],
    subCore: ['인간과 심리'],
    recommendDomains: ['사회', '과학'],
  },
  {
    id: 'media',
    label: '미디어',
    departments: ['미디어학과', '언론정보학과', '신문방송학과', '광고홍보학과'],
    core: ['문학과 영상'],
    subCore: ['매체 의사소통'],
    recommendDomains: ['사회', '국어', '정보'],
  },
];

const recommendedCourses = (
  courses: string[],
  note: string,
  choose?: number,
): RecommendationRule => ({
  category: 'recommended',
  courses,
  choose,
  note,
});

const coreCourses = (
  courses: string[],
  note: string,
  choose?: number,
): RecommendationRule => ({ category: 'core', courses, choose, note });

const yonseiMath = recommendedCourses(
  ['기하', '미적분 II'],
  '수학 진로선택: 기하, 미적분Ⅱ',
);
const yonseiScienceCareer: RecommendationRule = {
  category: 'recommended',
  courses: [
    '역학과 에너지',
    '전자기와 양자',
    '물질과 에너지',
    '화학 반응의 세계',
    '세포와 물질대사',
    '생물의 유전',
    '지구시스템과학',
    '행성우주과학',
  ],
  choose: 3,
  note: '과학 진로선택 3과목 이상',
};

export const UNIVERSITY_RECOMMENDATIONS: UniversityRecommendation[] = [
  {
    university: '중앙대',
    departments: [
      '기계공학부',
      '물리학과',
      '사회기반시스템공학부(건설환경플랜트공학)',
      '전자전기공학부',
      '지능형반도체공학과',
    ],
    profileIds: ['physics-chemistry', 'physics-earth'],
    rules: [
      recommendedCourses(['미적분 II', '기하'], '수학 진로선택'),
      recommendedCourses(['물리학', '화학'], '과학 일반선택'),
      recommendedCourses(['역학과 에너지', '전자기와 양자'], '과학 진로선택'),
    ],
  },
  {
    university: '중앙대',
    departments: ['에너지시스템공학부', '첨단소재공학과', '화학공학과'],
    profileIds: ['physics-chemistry-combined'],
    rules: [
      recommendedCourses(['미적분 II', '기하'], '수학 진로선택'),
      recommendedCourses(['화학', '물리학'], '과학 일반선택'),
      recommendedCourses(
        ['물질과 에너지', '화학 반응의 세계'],
        '과학 진로선택',
      ),
    ],
  },
  {
    university: '중앙대',
    departments: ['융합공학부'],
    profileIds: ['physics-chemistry-combined', 'chemistry-biology'],
    rules: [
      recommendedCourses(['미적분 II', '기하'], '수학 진로선택'),
      {
        ...recommendedCourses(
          ['화학', '물리학', '생명과학'],
          '화학과 물리학 또는 화학과 생명과학',
          2,
        ),
        requiredCourses: ['화학'],
      },
      recommendedCourses(
        ['물질과 에너지', '화학 반응의 세계'],
        '과학 진로선택',
      ),
    ],
  },
  {
    university: '중앙대',
    departments: ['건축학부'],
    matchTerms: ['건축학과'],
    profileIds: ['physics-earth'],
    rules: [
      recommendedCourses(['미적분 II', '기하'], '수학 진로선택'),
      recommendedCourses(['물리학'], '과학 일반선택'),
      recommendedCourses(['역학과 에너지', '전자기와 양자'], '과학 진로선택'),
    ],
  },
  {
    university: '중앙대',
    departments: ['사회기반시스템공학부(도시시스템공학)'],
    matchTerms: ['도시공학과'],
    profileIds: ['physics-earth-combined'],
    rules: [
      recommendedCourses(['미적분 II', '기하'], '수학 진로선택'),
      recommendedCourses(['물리학'], '과학 일반선택'),
      recommendedCourses(['역학과 에너지', '전자기와 양자'], '과학 진로선택'),
    ],
  },
  {
    university: '중앙대',
    departments: ['소프트웨어학부'],
    matchTerms: ['컴퓨터공학과', '소프트웨어학과'],
    profileIds: ['math-computing'],
    rules: [
      recommendedCourses(['미적분 II', '기하'], '수학 진로선택'),
      recommendedCourses(['물리학'], '과학 일반선택'),
      recommendedCourses(['역학과 에너지', '전자기와 양자'], '과학 진로선택'),
    ],
  },
  {
    university: '중앙대',
    departments: ['AI학과', '산업보안학과(자연)', '수학과', '예술공학부'],
    matchTerms: ['인공지능학과', '정보보안학과'],
    profileIds: ['math', 'math-computing'],
    rules: [recommendedCourses(['미적분 II', '기하'], '수학 진로선택')],
  },
  {
    university: '중앙대',
    departments: ['약학부', '의학부'],
    matchTerms: ['약학과', '의학과', '의예과'],
    profileIds: ['chemistry-biology'],
    rules: [
      recommendedCourses(['미적분 II', '기하'], '수학 진로선택'),
      recommendedCourses(['생명과학', '화학'], '과학 일반선택'),
      recommendedCourses(
        ['물질과 에너지', '화학 반응의 세계', '세포와 물질대사', '생물의 유전'],
        '과학 진로선택 중 3과목 이상',
        3,
      ),
    ],
  },
  {
    university: '중앙대',
    departments: ['생명과학과'],
    profileIds: ['biology'],
    rules: [
      recommendedCourses(['미적분 II'], '수학 진로선택'),
      recommendedCourses(['생명과학', '화학'], '과학 일반선택'),
      recommendedCourses(
        ['물질과 에너지', '화학 반응의 세계', '세포와 물질대사', '생물의 유전'],
        '과학 진로선택 중 2과목 이상',
        2,
      ),
    ],
  },
  {
    university: '중앙대',
    departments: ['화학과'],
    profileIds: ['chemistry'],
    rules: [
      recommendedCourses(['미적분 II'], '수학 진로선택'),
      {
        ...recommendedCourses(
          ['화학', '물리학', '생명과학'],
          '화학과 물리학 또는 화학과 생명과학',
          2,
        ),
        requiredCourses: ['화학'],
      },
      recommendedCourses(
        ['물질과 에너지', '화학 반응의 세계', '세포와 물질대사', '생물의 유전'],
        '과학 진로선택 중 2과목 이상',
        2,
      ),
    ],
  },
  {
    university: '중앙대',
    departments: ['시스템생명공학과', '식품공학부(식품공학, 식품영양)'],
    profileIds: ['chemistry-biology', 'biology'],
    rules: [
      recommendedCourses(['미적분 II', '기하'], '미적분Ⅱ 또는 기하', 1),
      recommendedCourses(['생명과학', '화학'], '과학 일반선택'),
    ],
  },
  {
    university: '중앙대',
    departments: ['간호학과'],
    profileIds: ['chemistry-biology'],
    rules: [
      recommendedCourses(['미적분 II'], '수학 진로선택'),
      recommendedCourses(['생명과학'], '과학 일반선택'),
      recommendedCourses(['세포와 물질대사', '생물의 유전'], '과학 진로선택'),
    ],
  },
  {
    university: '중앙대',
    departments: ['생명자원공학부(동물생명공학, 식물생명공학)'],
    profileIds: ['biology', 'chemistry-biology'],
    rules: [
      recommendedCourses(['미적분 II'], '수학 진로선택'),
      recommendedCourses(['생명과학', '화학'], '과학 일반선택'),
      recommendedCourses(['세포와 물질대사', '생물의 유전'], '과학 진로선택'),
    ],
  },

  {
    university: '고려대',
    departments: ['생명과학부', '생명공학부', '식품공학과', '환경생태공학부'],
    profileIds: ['biology', 'chemistry-biology'],
    rules: [
      recommendedCourses(
        ['물질과 에너지', '화학 반응의 세계', '세포와 물질대사', '생물의 유전'],
        '과학 진로선택 중 2개 과목 이상',
        2,
      ),
    ],
  },
  {
    university: '고려대',
    departments: ['수학과', '수학교육과'],
    profileIds: ['math'],
    rules: [recommendedCourses(['기하'], '수학 권장이수과목')],
  },
  {
    university: '고려대',
    departments: ['물리학과', '기계공학부', '반도체공학과', '차세대통신학과'],
    profileIds: ['physics-chemistry'],
    rules: [
      recommendedCourses(['역학과 에너지', '전자기와 양자'], '과학 진로선택'),
    ],
  },
  {
    university: '고려대',
    departments: ['화학과'],
    profileIds: ['chemistry'],
    rules: [
      recommendedCourses(
        ['물질과 에너지', '화학 반응의 세계'],
        '과학 진로선택',
      ),
    ],
  },
  {
    university: '고려대',
    departments: ['지구환경과학과'],
    matchTerms: ['지구과학과', '지질학과'],
    profileIds: ['earth'],
    rules: [
      recommendedCourses(['지구시스템과학', '행성우주과학'], '과학 진로선택'),
    ],
  },
  {
    university: '고려대',
    departments: ['공과대학(전공자율선택제)'],
    profileIds: ['physics-chemistry', 'physics-chemistry-combined'],
    rules: [
      recommendedCourses(
        [
          '역학과 에너지',
          '전자기와 양자',
          '물질과 에너지',
          '화학 반응의 세계',
          '세포와 물질대사',
          '생물의 유전',
        ],
        '과학 진로선택 중 2개 과목 이상',
        2,
      ),
    ],
  },
  {
    university: '고려대',
    departments: ['화공생명공학과'],
    profileIds: ['physics-chemistry-combined', 'chemistry-biology'],
    rules: [
      recommendedCourses(['기하'], '수학 권장이수과목'),
      recommendedCourses(
        ['역학과 에너지', '전자기와 양자', '물질과 에너지', '화학 반응의 세계'],
        '과학 진로선택 중 2개 과목 이상',
        2,
      ),
    ],
  },
  {
    university: '고려대',
    departments: ['신소재공학부', '융합에너지공학과', '스마트모빌리티학부'],
    profileIds: ['physics-chemistry-combined'],
    rules: [
      recommendedCourses(
        ['역학과 에너지', '전자기와 양자', '물질과 에너지', '화학 반응의 세계'],
        '과학 진로선택 중 2개 과목 이상',
        2,
      ),
    ],
  },
  {
    university: '고려대',
    departments: ['건축사회환경공학부'],
    matchTerms: ['건축공학과', '사회환경공학과', '토목공학과'],
    profileIds: ['physics-earth'],
    rules: [recommendedCourses(['역학과 에너지'], '과학 진로선택')],
  },
  {
    university: '고려대',
    departments: ['전기전자공학부'],
    profileIds: ['physics-chemistry'],
    rules: [
      recommendedCourses(['기하'], '수학 권장이수과목'),
      recommendedCourses(
        ['역학과 에너지', '전자기와 양자', '물질과 에너지', '화학 반응의 세계'],
        '과학 진로선택 중 2개 과목 이상',
        2,
      ),
    ],
  },
  {
    university: '고려대',
    departments: ['의과대학', '간호대학'],
    matchTerms: ['의학과', '의예과', '간호학과'],
    profileIds: ['chemistry-biology'],
    rules: [
      recommendedCourses(
        ['물질과 에너지', '화학 반응의 세계', '세포와 물질대사', '생물의 유전'],
        '과학 진로선택 중 2개 과목 이상',
        2,
      ),
    ],
  },
  {
    university: '고려대',
    departments: [
      '컴퓨터학과',
      '데이터과학과',
      '인공지능학과',
      '사이버국방학과',
      '스마트보안학부',
    ],
    matchTerms: ['컴퓨터공학과', '소프트웨어학과', '정보보안학과'],
    profileIds: ['math-computing'],
    rules: [recommendedCourses(['기하'], '수학 권장이수과목')],
  },
  {
    university: '고려대',
    departments: ['바이오의공학부'],
    profileIds: ['chemistry-biology', 'physics-chemistry-combined'],
    rules: [
      recommendedCourses(
        ['역학과 에너지', '전자기와 양자', '물질과 에너지', '화학 반응의 세계'],
        '과학 진로선택 중 2개 과목 이상',
        2,
      ),
    ],
  },
  {
    university: '고려대',
    departments: ['바이오시스템의과학부', '보건환경융합과학부'],
    profileIds: ['chemistry-biology', 'biology'],
    rules: [
      recommendedCourses(
        ['물질과 에너지', '화학 반응의 세계', '세포와 물질대사', '생물의 유전'],
        '과학 진로선택 중 2개 과목 이상',
        2,
      ),
    ],
  },

  {
    university: '경희대',
    departments: ['수학과', '응용수학과'],
    profileIds: ['math'],
    rules: [
      coreCourses(
        ['대수', '미적분 I', '확률과 통계', '미적분 II', '기하'],
        '핵심 수학교과',
      ),
    ],
  },
  {
    university: '경희대',
    departments: ['소프트웨어융합학과', '인공지능학과', '컴퓨터공학과'],
    profileIds: ['math-computing'],
    rules: [
      coreCourses(
        ['대수', '미적분 I', '확률과 통계', '미적분 II', '기하'],
        '핵심 수학교과',
      ),
      recommendedCourses(['인공지능 수학'], '권장 수학교과'),
    ],
  },
  {
    university: '경희대',
    departments: ['산업경영공학과'],
    profileIds: ['math-computing'],
    rules: [
      coreCourses(
        ['대수', '미적분 I', '확률과 통계', '미적분 II'],
        '핵심 수학교과',
      ),
    ],
  },
  {
    university: '경희대',
    departments: ['물리학과', '응용물리학과'],
    profileIds: ['physics-chemistry'],
    rules: [
      coreCourses(
        ['대수', '미적분 I', '확률과 통계', '미적분 II', '기하'],
        '핵심 수학교과',
      ),
      coreCourses(
        ['물리학', '역학과 에너지', '전자기와 양자'],
        '핵심 과학교과',
      ),
      recommendedCourses(['화학', '물질과 에너지'], '권장 과학교과'),
    ],
  },
  {
    university: '경희대',
    departments: ['기계공학부'],
    profileIds: ['physics-chemistry'],
    rules: [
      coreCourses(
        ['대수', '미적분 I', '확률과 통계', '미적분 II', '기하'],
        '핵심 수학교과',
      ),
      coreCourses(
        ['물리학', '화학', '역학과 에너지', '전자기와 양자'],
        '핵심 과학교과',
      ),
      recommendedCourses(
        ['물질과 에너지', '화학 반응의 세계'],
        '권장 과학교과',
      ),
    ],
  },
  {
    university: '경희대',
    departments: [
      '미래정보디스플레이학부',
      '생체의공학과',
      '전자공학과',
      '반도체공학과',
    ],
    profileIds: ['physics-chemistry'],
    rules: [
      coreCourses(
        ['대수', '미적분 I', '확률과 통계', '미적분 II', '기하'],
        '핵심 수학교과',
      ),
      coreCourses(
        ['물리학', '화학', '역학과 에너지', '전자기와 양자'],
        '핵심 과학교과',
      ),
    ],
  },
  {
    university: '경희대',
    departments: ['건축공학과', '사회기반시스템공학과'],
    profileIds: ['physics-earth'],
    rules: [
      coreCourses(
        ['대수', '미적분 I', '확률과 통계', '미적분 II'],
        '핵심 수학교과',
      ),
      coreCourses(['물리학'], '핵심 과학교과'),
      recommendedCourses(['기하'], '권장 수학교과'),
    ],
  },
  {
    university: '경희대',
    departments: ['건축학과'],
    profileIds: ['physics-earth'],
    rules: [
      coreCourses(['대수', '미적분 I', '확률과 통계'], '핵심 수학교과'),
      recommendedCourses(['미적분 II', '기하'], '권장 수학교과'),
      recommendedCourses(['물리학'], '권장 과학교과'),
    ],
  },
  {
    university: '경희대',
    departments: ['화학과', '응용화학과'],
    profileIds: ['chemistry'],
    rules: [
      coreCourses(
        ['대수', '미적분 I', '확률과 통계', '미적분 II'],
        '핵심 수학교과',
      ),
      coreCourses(
        ['화학', '물질과 에너지', '화학 반응의 세계'],
        '핵심 과학교과',
      ),
      recommendedCourses(['기하'], '권장 수학교과'),
      {
        ...recommendedCourses(
          ['물리학', '생명과학', '역학과 에너지', '전자기와 양자'],
          '물리학·생명과학 및 역학과 에너지·전자기와 양자 중 1과목',
          3,
        ),
        requiredCourses: ['물리학', '생명과학'],
      },
    ],
  },
  {
    university: '경희대',
    departments: ['원자력공학과', '신소재공학과'],
    profileIds: ['physics-chemistry-combined'],
    rules: [
      coreCourses(
        ['대수', '미적분 I', '확률과 통계', '미적분 II', '기하'],
        '핵심 수학교과',
      ),
      coreCourses(
        ['물리학', '화학', '물질과 에너지', '역학과 에너지'],
        '핵심 과학교과',
      ),
      recommendedCourses(
        ['전자기와 양자', '화학 반응의 세계'],
        '권장 과학교과',
      ),
    ],
  },
  {
    university: '경희대',
    departments: ['화학공학과'],
    profileIds: ['physics-chemistry-combined'],
    rules: [
      coreCourses(
        ['대수', '미적분 I', '확률과 통계', '미적분 II'],
        '핵심 수학교과',
      ),
      coreCourses(
        ['물리학', '화학', '물질과 에너지', '화학 반응의 세계'],
        '핵심 과학교과',
      ),
      recommendedCourses(['기하'], '권장 수학교과'),
      recommendedCourses(['역학과 에너지', '전자기와 양자'], '권장 과학교과'),
    ],
  },
  {
    university: '경희대',
    departments: ['생물학과', '스마트팜과학과'],
    profileIds: ['biology'],
    rules: [
      coreCourses(['대수', '미적분 I', '확률과 통계'], '핵심 수학교과'),
      coreCourses(
        ['화학', '생명과학', '세포와 물질대사', '생물의 유전'],
        '핵심 과학교과',
      ),
      recommendedCourses(['미적분 II'], '권장 수학교과'),
      recommendedCourses(['물리학'], '권장 과학교과'),
    ],
  },
  {
    university: '경희대',
    departments: [
      '식품영양학과',
      '식품생명공학과',
      '유전생명공학과',
      '환경학및환경공학과',
    ],
    profileIds: ['biology', 'chemistry-biology'],
    rules: [
      coreCourses(['대수', '미적분 I', '확률과 통계'], '핵심 수학교과'),
      coreCourses(
        ['화학', '생명과학', '세포와 물질대사', '생물의 유전'],
        '핵심 과학교과',
      ),
      recommendedCourses(['미적분 II'], '권장 수학교과'),
      recommendedCourses(
        ['물질과 에너지', '화학 반응의 세계'],
        '권장 과학교과',
      ),
    ],
  },
  {
    university: '경희대',
    departments: ['융합바이오·신소재공학과'],
    profileIds: ['chemistry-biology', 'physics-chemistry-combined'],
    rules: [
      coreCourses(['대수', '미적분 I', '확률과 통계'], '핵심 수학교과'),
      coreCourses(
        [
          '화학',
          '생명과학',
          '세포와 물질대사',
          '생물의 유전',
          '물질과 에너지',
          '화학 반응의 세계',
        ],
        '핵심 과학교과',
      ),
      recommendedCourses(['미적분 II'], '권장 수학교과'),
    ],
  },
  {
    university: '경희대',
    departments: ['지리학과'],
    profileIds: ['earth'],
    rules: [
      coreCourses(['대수', '미적분 I', '확률과 통계'], '핵심 수학교과'),
      coreCourses(['지구과학'], '핵심 과학교과'),
    ],
  },
  {
    university: '경희대',
    departments: ['우주과학과'],
    matchTerms: ['천문학과'],
    profileIds: ['physics-earth-combined'],
    rules: [
      coreCourses(
        ['대수', '미적분 I', '확률과 통계', '미적분 II'],
        '핵심 수학교과',
      ),
      coreCourses(
        ['물리학', '화학', '지구과학', '역학과 에너지', '전자기와 양자'],
        '핵심 과학교과',
      ),
      recommendedCourses(['기하'], '권장 수학교과'),
      recommendedCourses(
        ['지구시스템과학', '행성우주과학'],
        '권장 과학교과 중 1과목',
        1,
      ),
    ],
  },
  {
    university: '경희대',
    departments: ['의예과'],
    profileIds: ['chemistry-biology'],
    rules: [
      coreCourses(
        ['대수', '미적분 I', '확률과 통계', '미적분 II'],
        '핵심 수학교과',
      ),
      coreCourses(['화학', '생명과학'], '핵심 과학교과'),
      coreCourses(
        ['물질과 에너지', '화학 반응의 세계', '세포와 물질대사', '생물의 유전'],
        '핵심 과학교과 중 3과목',
        3,
      ),
      recommendedCourses(['물리학'], '권장 과학교과'),
    ],
  },
  {
    university: '경희대',
    departments: ['한의예과', '치의예과'],
    profileIds: ['chemistry-biology'],
    rules: [
      coreCourses(
        ['대수', '미적분 I', '확률과 통계', '미적분 II'],
        '핵심 수학교과',
      ),
      coreCourses(
        ['화학', '생명과학', '세포와 물질대사', '생물의 유전'],
        '핵심 과학교과',
      ),
      recommendedCourses(['물리학'], '권장 과학교과'),
      recommendedCourses(
        ['물질과 에너지', '화학 반응의 세계'],
        '권장 과학교과 중 1과목',
        1,
      ),
    ],
  },
  {
    university: '경희대',
    departments: ['약학과', '한약학과', '약과학과'],
    profileIds: ['chemistry-biology'],
    rules: [
      coreCourses(
        ['대수', '미적분 I', '확률과 통계', '미적분 II'],
        '핵심 수학교과',
      ),
      coreCourses(['화학', '생명과학'], '핵심 과학교과'),
      coreCourses(
        ['물질과 에너지', '화학 반응의 세계', '세포와 물질대사', '생물의 유전'],
        '핵심 과학교과 중 3과목',
        3,
      ),
      recommendedCourses(['물리학'], '권장 과학교과'),
    ],
  },
  {
    university: '경희대',
    departments: ['간호학과'],
    profileIds: ['chemistry-biology'],
    rules: [
      coreCourses(['대수', '미적분 I', '확률과 통계'], '핵심 수학교과'),
      coreCourses(
        ['생명과학', '세포와 물질대사', '생물의 유전'],
        '핵심 과학교과',
      ),
      recommendedCourses(['미적분 II'], '권장 수학교과'),
      recommendedCourses(
        ['화학', '물질과 에너지', '화학 반응의 세계'],
        '권장 과학교과',
      ),
    ],
  },

  {
    university: '연세대',
    departments: [
      '수학과',
      '건축공학과',
      '도시공학과',
      '사회환경시스템공학부',
      '산업공학과',
    ],
    profileIds: ['math', 'physics-earth', 'physics-earth-combined'],
    rules: [
      yonseiMath,
      {
        category: 'recommended',
        domain: '과학',
        selectionType: 'general',
        note: '과학 일반선택 자율선택',
      },
      yonseiScienceCareer,
    ],
  },
  {
    university: '연세대',
    departments: [
      '물리학과',
      '전기전자공학부',
      '기계공학부',
      '시스템반도체공학과',
      '디스플레이융합공학과',
    ],
    profileIds: ['physics-chemistry'],
    rules: [
      yonseiMath,
      recommendedCourses(['물리학'], '과학 일반선택'),
      yonseiScienceCareer,
    ],
  },
  {
    university: '연세대',
    departments: ['화학과', '화공생명공학부', '신소재공학부'],
    profileIds: [
      'chemistry',
      'physics-chemistry-combined',
      'chemistry-biology',
    ],
    rules: [
      yonseiMath,
      recommendedCourses(['화학'], '과학 일반선택'),
      yonseiScienceCareer,
    ],
  },
  {
    university: '연세대',
    departments: ['지구시스템과학과', '천문우주학과', '대기과학과'],
    matchTerms: ['지구과학과', '천문학과'],
    profileIds: ['earth', 'physics-earth-combined'],
    rules: [
      yonseiMath,
      recommendedCourses(['지구과학'], '과학 일반선택'),
      yonseiScienceCareer,
    ],
  },
  {
    university: '연세대',
    departments: [
      '생명과학부',
      '시스템생물학과',
      '생화학과',
      '생명공학과',
      '의예과',
    ],
    profileIds: ['biology', 'chemistry-biology'],
    rules: [
      yonseiMath,
      recommendedCourses(['생명과학'], '과학 일반선택'),
      yonseiScienceCareer,
    ],
  },
  {
    university: '연세대',
    departments: [
      '컴퓨터과학과',
      '인공지능학과',
      '인공지능시스템학과',
      'IT융합공학전공',
      '지능형반도체전공',
      '모빌리티시스템전공',
      '언더우드학부(생명과학공학)',
      '융합과학공학부(ISE)',
      '진리자유학부(자연)',
    ],
    matchTerms: ['컴퓨터공학과', '소프트웨어학과', '정보보안학과'],
    profileIds: ['math-computing', 'physics-chemistry', 'chemistry-biology'],
    rules: [
      yonseiMath,
      {
        category: 'recommended',
        domain: '과학',
        selectionType: 'general',
        note: '과학 일반선택 자율선택',
      },
      yonseiScienceCareer,
    ],
  },
  {
    university: '연세대',
    departments: ['치의예과'],
    profileIds: ['chemistry-biology'],
    rules: [
      yonseiMath,
      recommendedCourses(
        ['물리학', '화학', '생명과학'],
        '과학 일반선택 중 1과목',
        1,
      ),
      yonseiScienceCareer,
    ],
  },
  {
    university: '연세대',
    departments: ['약학과', '첨단약과학과'],
    profileIds: ['chemistry-biology'],
    rules: [
      yonseiMath,
      recommendedCourses(['생명과학', '화학'], '생명과학 또는 화학', 1),
      yonseiScienceCareer,
    ],
  },
];

export const RECOMMENDATION_SOURCES = [
  {
    university: '중앙대',
    title: '2028학년도 대학입학전형 학문단위별 이수 권장과목 안내(자연계열)',
  },
  {
    university: '고려대',
    title: '고려대학교 대입전형 자연계열 권장이수과목(2022 개정 교육과정)',
  },
  {
    university: '경희대',
    title:
      '2028 자연계열 전공 학문 분야별 고등학교 교과 이수 권장과목 수정 안내(2025.8)',
  },
  {
    university: '연세대',
    title: '2028학년도 전공연계과목 선택 가이드라인 안내(2026.4)',
  },
] as const;

export function normalizeCourseName(value: string) {
  const normalized = value
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/[·ㆍ,()\[\]]/g, '')
    .toLocaleLowerCase('ko-KR');
  if (normalized === '미적분2' || normalized === '미적분ii') return '미적분ii';
  if (normalized === '미적분1' || normalized === '미적분i') return '미적분i';
  if (normalized === '생물') return '생명과학';
  return normalized;
}

function normalizeDepartment(value: string) {
  return value
    .normalize('NFKC')
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s·ㆍ,()\[\]\/\-]/g, '')
    .replace(/학과$|학부$|전공$/g, '')
    .toLocaleLowerCase('ko-KR');
}

function bigrams(value: string) {
  if (value.length < 2) return [value];
  return Array.from({ length: value.length - 1 }, (_, index) =>
    value.slice(index, index + 2),
  );
}

function departmentSimilarity(left: string, right: string) {
  const a = normalizeDepartment(left);
  const b = normalizeDepartment(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return (
      0.82 +
      (0.16 * Math.min(a.length, b.length)) / Math.max(a.length, b.length)
    );
  }
  const aPairs = bigrams(a);
  const bPairs = [...bigrams(b)];
  let overlap = 0;
  for (const pair of aPairs) {
    const index = bPairs.indexOf(pair);
    if (index >= 0) {
      overlap += 1;
      bPairs.splice(index, 1);
    }
  }
  return (2 * overlap) / (aPairs.length + bigrams(b).length);
}

export function findPriorityProfile(department: string) {
  let best: { profile: PriorityProfile; score: number } | null = null;
  for (const profile of PRIORITY_PROFILES) {
    const score = Math.max(
      ...profile.departments.map((candidate) =>
        departmentSimilarity(department, candidate),
      ),
    );
    if (!best || score > best.score) best = { profile, score };
  }
  return best && best.score >= 0.32 ? best : null;
}

export function findUniversityMatches(
  department: string,
  profileId: PriorityProfileId | null,
) {
  const matches: UniversityMatch[] = [];
  for (const university of ['고려대', '연세대', '경희대', '중앙대'] as const) {
    let best: UniversityMatch | null = null;
    for (const recommendation of UNIVERSITY_RECOMMENDATIONS) {
      if (recommendation.university !== university) continue;
      if (profileId && !recommendation.profileIds.includes(profileId)) continue;
      const candidates = [
        ...recommendation.departments,
        ...(recommendation.matchTerms ?? []),
      ];
      const scored = candidates.map((candidate) => ({
        candidate,
        score: departmentSimilarity(department, candidate),
      }));
      const closest = scored.sort((a, b) => b.score - a.score)[0];
      if (!closest || closest.score < 0.32) continue;
      const officialDepartment = recommendation.departments
        .map((candidate) => ({
          candidate,
          score: departmentSimilarity(closest.candidate, candidate),
        }))
        .sort((a, b) => b.score - a.score)[0]?.candidate;
      const match: UniversityMatch = {
        ...recommendation,
        matchedDepartment: officialDepartment ?? recommendation.departments[0],
        score: closest.score,
      };
      if (!best || match.score > best.score) best = match;
    }
    if (best) matches.push(best);
  }
  return matches;
}

export function ruleMatchesCourse(
  rule: RecommendationRule,
  course: {
    name: string;
    domain: string | null;
    selectionType?: string | null;
  },
) {
  const courseMatch = rule.courses?.some(
    (candidate) =>
      normalizeCourseName(candidate) === normalizeCourseName(course.name),
  );
  const domainMatch = rule.domain === course.domain;
  const typeMatch =
    !rule.selectionType || rule.selectionType === course.selectionType;
  return Boolean(courseMatch || (domainMatch && typeMatch));
}
