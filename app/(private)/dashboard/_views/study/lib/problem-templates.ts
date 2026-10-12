import type { Activity } from './fields';

// 시험 구분이 특정되지 않은 공통 학습 상황은 기타로 분류한다.
// 특정되지 않은 세부 과목명은 빈 값으로 둔다.
type ProblemTemplate = {
  id: string;
} & Pick<
  Activity['values'],
  'problem' | 'category' | 'subject' | 'customSubject'
>;

export const problemTemplates = [
  {
    id: 'qa-01',
    problem: '수학 수업 직후에는 이해하지만 다음 날 배운 내용이 기억나지 않음',
    category: '기타',
    subject: '수학',
    customSubject: '',
  },
  {
    id: 'qa-02',
    problem: '수학 오답을 반복해서 풀어도 개념이 기억나지 않아 재풀이에 어려움',
    category: '기타',
    subject: '수학',
    customSubject: '',
  },
  {
    id: 'qa-03',
    problem: '수학 인강 수강과 기출 학습에 과도한 시간 소요',
    category: '모의고사(수능)',
    subject: '수학',
    customSubject: '',
  },
  {
    id: 'qa-04',
    problem: '수학 알고리즘·확률·경우의 수 영역의 상대적인 취약함',
    category: '기타',
    subject: '수학',
    customSubject: '',
  },
  {
    id: 'qa-05',
    problem: '대수 선행학습 후 배운 개념의 대부분을 잊어버림',
    category: '기타',
    subject: '수학',
    customSubject: '대수',
  },
  {
    id: 'qa-06',
    problem: '영어 성적 하락으로 장기간 학습을 중단한 뒤 재시작에 어려움',
    category: '기타',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'qa-07',
    problem: '영어 단어를 예문과 함께 암기할 때 과도한 시간 소요',
    category: '기타',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'qa-08',
    problem: '여러 암기법을 시도해도 영어 단어 암기 효율이 낮음',
    category: '기타',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'qa-09',
    problem:
      '영어 어휘 부족으로 내신의 문맥상 부적절한 어휘 고르기 유형에서 잦은 오답',
    category: '내신',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'qa-10',
    problem: '영어 모의고사에서 어휘 부족으로 정확한 해석보다 문맥 추측에 의존',
    category: '모의고사(수능)',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'qa-11',
    problem: '수능 국어 인강에 집중하지 못해 내용 이해가 어렵고 수강이 밀림',
    category: '모의고사(수능)',
    subject: '국어',
    customSubject: '',
  },
  {
    id: 'qa-12',
    problem:
      '중학교 수학 기초가 부족한 상태에서 고등학교 수학 학습 시작에 어려움',
    category: '기타',
    subject: '수학',
    customSubject: '',
  },
  {
    id: 'qa-13',
    problem:
      '수학 선행이 부족한 예비 고1의 모의고사·내신 준비 우선순위 결정에 어려움',
    category: '기타',
    subject: '수학',
    customSubject: '',
  },
  {
    id: 'qa-14',
    problem: '기하 독학 시 방학 중 예습 범위와 문제 난이도 설정에 어려움',
    category: '내신',
    subject: '수학',
    customSubject: '기하',
  },
  {
    id: 'qa-15',
    problem: '영어 학습 공백 이후 현재 수준에 맞는 기출 난이도 선택에 어려움',
    category: '모의고사(수능)',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'qa-16',
    problem: '영어 문제 풀이 후 오답 분석 방법을 정하지 못함',
    category: '기타',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'qa-17',
    problem:
      '예비 고1 국어 학습에서 모의고사 풀이와 문법 공부의 우선순위 결정에 어려움',
    category: '기타',
    subject: '국어',
    customSubject: '',
  },
  {
    id: 'qa-18',
    problem:
      '수능 국어 연계 학습이 부족한 상태에서 수능특강·수능완성·기출의 우선순위 결정에 어려움',
    category: '모의고사(수능)',
    subject: '국어',
    customSubject: '',
  },
  {
    id: 'qa-19',
    problem: '사회탐구 단권화와 백지 복습의 시작 시점 결정에 어려움',
    category: '기타',
    subject: '사회',
    customSubject: '',
  },
  {
    id: 'qa-20',
    problem: '사회탐구 단권화에 포함할 개념의 범위와 선정 기준이 불명확함',
    category: '기타',
    subject: '사회',
    customSubject: '',
  },
] as const satisfies readonly ProblemTemplate[];
