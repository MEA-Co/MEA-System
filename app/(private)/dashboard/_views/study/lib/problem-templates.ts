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
    id: 'week2-korean-01',
    problem: '비문학 지문을 읽어도 핵심 내용과 글의 구조가 잘 파악되지 않음',
    category: '기타',
    subject: '국어',
    customSubject: '',
  },
  {
    id: 'week2-korean-02',
    problem: '비문학 지문은 이해했지만 선지에서 정답과 오답을 구분하기 어려움',
    category: '기타',
    subject: '국어',
    customSubject: '',
  },
  {
    id: 'week2-korean-03',
    problem: '과학·기술·경제 등 낯선 소재의 비문학 지문에서 정답률이 떨어짐',
    category: '기타',
    subject: '국어',
    customSubject: '',
  },
  {
    id: 'week2-korean-04',
    problem: '고전시가·고전소설의 어휘와 표현이 낯설어 작품을 이해하기 어려움',
    category: '기타',
    subject: '국어',
    customSubject: '',
  },
  {
    id: 'week2-korean-05',
    problem:
      '문학 작품을 공부해도 처음 보는 작품이나 변형 문제에 적용하기 어려움',
    category: '기타',
    subject: '국어',
    customSubject: '',
  },
  {
    id: 'week2-korean-06',
    problem: '문법 개념은 외웠지만 실제 문법 문제에 적용할 때 자주 틀림',
    category: '기타',
    subject: '국어',
    customSubject: '',
  },
  {
    id: 'week2-korean-07',
    problem: '국어 모의고사에서 시간이 부족해 일부 지문을 풀지 못함',
    category: '모의고사(수능)',
    subject: '국어',
    customSubject: '',
  },
  {
    id: 'week2-korean-08',
    problem: '국어 시험에서 두 개의 선지 중 고민하다 틀리는 경우가 반복됨',
    category: '기타',
    subject: '국어',
    customSubject: '',
  },
  {
    id: 'week2-korean-09',
    problem:
      '학교 내신 국어에서 교과서·부교재·외부 지문을 어떻게 공부해야 할지 모르겠음',
    category: '내신',
    subject: '국어',
    customSubject: '',
  },
  {
    id: 'week2-korean-10',
    problem:
      '국어 내신의 작품별 세부 내용과 암기 사항을 효율적으로 정리하기 어려움',
    category: '내신',
    subject: '국어',
    customSubject: '',
  },
  {
    id: 'week2-english-01',
    problem: '영어 단어를 반복해서 외워도 금방 잊어버림',
    category: '기타',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'week2-english-02',
    problem: '단어의 뜻은 알지만 문맥에 따라 달라지는 의미를 파악하기 어려움',
    category: '기타',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'week2-english-03',
    problem:
      '문장의 단어는 대부분 아는데 문장 전체의 구조와 의미가 이해되지 않음',
    category: '기타',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'week2-english-04',
    problem:
      '영어 지문을 해석할 수는 있지만 글의 주제와 핵심 논지를 파악하기 어려움',
    category: '기타',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'week2-english-05',
    problem:
      '글의 순서 배열·문장 삽입 문제에서 문장 간 연결 관계를 찾기 어려움',
    category: '기타',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'week2-english-06',
    problem: '영어 독해 속도가 느려 제한 시간 안에 모든 문제를 풀지 못함',
    category: '기타',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'week2-english-07',
    problem: '어법 개념을 공부했지만 실제 어법 문제에서 자주 틀림',
    category: '기타',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'week2-english-08',
    problem: '영어 서술형에서 문법·어순·철자 오류로 반복적으로 감점됨',
    category: '기타',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'week2-english-09',
    problem: '영어 내신 시험 범위의 지문이 많아 암기와 복습이 어려움',
    category: '내신',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'week2-english-10',
    problem: '본문을 충분히 외웠지만 변형 문제에서 정답률이 떨어짐',
    category: '기타',
    subject: '영어',
    customSubject: '',
  },
  {
    id: 'week2-math-01',
    problem:
      '개념과 공식은 외웠지만 문제를 보면 어떤 개념을 사용해야 할지 모르겠음',
    category: '기타',
    subject: '수학',
    customSubject: '',
  },
  {
    id: 'week2-math-02',
    problem: '유형별 문제는 잘 풀지만 여러 개념이 결합된 문제에서 막힘',
    category: '기타',
    subject: '수학',
    customSubject: '',
  },
  {
    id: 'week2-math-03',
    problem:
      '어려운 문제를 읽고 처음 어떤 방식으로 접근해야 할지 떠오르지 않음',
    category: '기타',
    subject: '수학',
    customSubject: '',
  },
  {
    id: 'week2-math-04',
    problem: '풀이 방향은 맞지만 계산 실수와 부호 실수로 반복적으로 감점됨',
    category: '기타',
    subject: '수학',
    customSubject: '',
  },
  {
    id: 'week2-math-05',
    problem: '해설지를 보면 이해되지만 혼자서 다시 풀면 풀리지 않음',
    category: '기타',
    subject: '수학',
    customSubject: '',
  },
  {
    id: 'week2-math-06',
    problem: '한 번 틀린 문제를 복습했는데도 비슷한 문제에서 다시 틀림',
    category: '기타',
    subject: '수학',
    customSubject: '',
  },
  {
    id: 'week2-math-07',
    problem: '수학 문제를 풀 때 시간이 오래 걸려 시험 시간 안에 끝내지 못함',
    category: '기타',
    subject: '수학',
    customSubject: '',
  },
  {
    id: 'week2-math-08',
    problem: '문제집을 여러 권 풀었지만 정답률이나 성적이 잘 오르지 않음',
    category: '기타',
    subject: '수학',
    customSubject: '',
  },
  {
    id: 'week2-math-09',
    problem:
      '이전 학년의 개념이 부족해 현재 배우는 수학 단원을 따라가기 어려움',
    category: '기타',
    subject: '수학',
    customSubject: '',
  },
  {
    id: 'week2-math-10',
    problem:
      '수학 오답노트를 만들고 있지만 분량만 늘고 실제 복습에는 활용하지 못함',
    category: '기타',
    subject: '수학',
    customSubject: '',
  },
  {
    id: 'week2-social-01',
    problem: '개념을 암기했지만 실제 사례에 적용하는 문제에서 자주 틀림',
    category: '기타',
    subject: '사회',
    customSubject: '',
  },
  {
    id: 'week2-social-02',
    problem: '비슷한 개념이나 이론의 차이를 정확하게 구별하지 못함',
    category: '기타',
    subject: '사회',
    customSubject: '',
  },
  {
    id: 'week2-social-03',
    problem:
      '사회 과목의 자료·도표·그래프를 해석하는 문제에서 시간이 오래 걸림',
    category: '기타',
    subject: '사회',
    customSubject: '',
  },
  {
    id: 'week2-social-04',
    problem: '역사 과목에서 사건의 순서와 시대별 흐름이 잘 정리되지 않음',
    category: '기타',
    subject: '사회',
    customSubject: '',
  },
  {
    id: 'week2-social-05',
    problem:
      '역사적 사건의 원인·전개·결과를 연결하지 못하고 단편적으로 암기하게 됨',
    category: '기타',
    subject: '사회',
    customSubject: '',
  },
  {
    id: 'week2-social-06',
    problem:
      '사회 내신의 교과서·프린트·수업 필기 내용을 어떻게 정리하고 암기해야 할지 모르겠음',
    category: '내신',
    subject: '사회',
    customSubject: '',
  },
  {
    id: 'week2-social-07',
    problem: '사회 과목에서 세부적인 암기 사항을 반복적으로 잊어버림',
    category: '기타',
    subject: '사회',
    customSubject: '',
  },
  {
    id: 'week2-social-08',
    problem: '객관식 선지의 작은 표현 차이나 예외 조건을 놓쳐 실수함',
    category: '기타',
    subject: '사회',
    customSubject: '',
  },
  {
    id: 'week2-science-01',
    problem:
      '개념은 이해했지만 새로운 현상이나 사례에 적용하는 문제를 풀기 어려움',
    category: '기타',
    subject: '과학',
    customSubject: '',
  },
  {
    id: 'week2-science-02',
    problem:
      '과학 계산 문제에서 어떤 공식과 조건을 적용해야 할지 판단하기 어려움',
    category: '기타',
    subject: '과학',
    customSubject: '',
  },
  {
    id: 'week2-science-03',
    problem:
      '물리학에서 힘·운동·에너지 등 상황을 분석하고 수식으로 표현하기 어려움',
    category: '기타',
    subject: '과학',
    customSubject: '물리학',
  },
  {
    id: 'week2-science-04',
    problem:
      '화학에서 반응식·몰·양적 관계 등 여러 조건을 연결하는 문제를 풀기 어려움',
    category: '기타',
    subject: '과학',
    customSubject: '화학',
  },
  {
    id: 'week2-science-05',
    problem:
      '생명과학에서 유전·세포 분열 등 복잡한 조건을 분석하는 문제에서 막힘',
    category: '기타',
    subject: '과학',
    customSubject: '생명과학',
  },
  {
    id: 'week2-science-06',
    problem:
      '지구과학에서 천체·대기·해양 등 공간적·시간적 변화를 해석하기 어려움',
    category: '기타',
    subject: '과학',
    customSubject: '지구과학',
  },
  {
    id: 'week2-science-07',
    problem: '과학 고난도 문제에서 조건을 정리하고 풀이 순서를 설정하기 어려움',
    category: '기타',
    subject: '과학',
    customSubject: '',
  },
  {
    id: 'week2-science-08',
    problem:
      '과학 문제집의 유형은 익숙하지만 낯선 자료나 응용 문제가 나오면 풀지 못함',
    category: '기타',
    subject: '과학',
    customSubject: '',
  },
  {
    id: 'week2-general-01',
    problem: '암기해야 할 내용이 많아 어디서부터 어떻게 공부해야 할지 모르겠음',
    category: '기타',
    subject: '기타',
    customSubject: '',
  },
  {
    id: 'week2-general-02',
    problem:
      '내용을 읽을 때는 익숙하지만 책을 덮고 스스로 설명하거나 떠올리기 어려움',
    category: '기타',
    subject: '기타',
    customSubject: '',
  },
  {
    id: 'week2-general-03',
    problem: '암기한 내용을 정확한 순서나 체계에 맞게 정리하기 어려움',
    category: '기타',
    subject: '기타',
    customSubject: '',
  },
  {
    id: 'week2-general-04',
    problem: '시험 범위가 넓어 복습을 충분히 하지 못하고 시험에 들어감',
    category: '기타',
    subject: '기타',
    customSubject: '',
  },
  {
    id: 'week2-general-05',
    problem:
      '여러 과목을 동시에 공부할 때 우선순위와 과목별 공부량을 정하기 어려움',
    category: '기타',
    subject: '기타',
    customSubject: '',
  },
  {
    id: 'week2-general-06',
    problem: '학습 계획은 자세하게 세우지만 실제 계획 달성률이 낮음',
    category: '기타',
    subject: '기타',
    customSubject: '',
  },
  {
    id: 'week2-general-07',
    problem:
      '학교 수업을 들은 뒤 그날 배운 내용을 어떻게 복습해야 할지 모르겠음',
    category: '기타',
    subject: '기타',
    customSubject: '',
  },
  {
    id: 'week2-general-08',
    problem:
      '시험을 앞두고 개념 복습과 문제 풀이 중 무엇을 우선해야 할지 모르겠음',
    category: '기타',
    subject: '기타',
    customSubject: '',
  },
  {
    id: 'week2-general-09',
    problem:
      '특정 과목에 시간을 지나치게 많이 써 다른 과목의 학습량이 부족해짐',
    category: '기타',
    subject: '기타',
    customSubject: '',
  },
  {
    id: 'week2-general-10',
    problem:
      '시험 결과를 확인해도 다음 시험을 위해 무엇을 바꿔야 할지 모르겠음',
    category: '기타',
    subject: '기타',
    customSubject: '',
  },
] as const satisfies readonly ProblemTemplate[];
