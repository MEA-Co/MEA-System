export const gradeOptions = ['1', '2', '3'];
export const semesterOptions = ['1', '2'];
export const recordTypeOptions = ['창체', '세특'];
export const creativeActivityOptions = [
  '자율·자치활동',
  '동아리활동',
  '진로활동',
];

export const groups = [
  {
    title: '기본 정보',
    description: '',
    hideHeading: true,
    fields: [
      {
        key: 'grade',
        required: true,
        label: '기재 영역 · 학년',
        placeholder: '학년 선택',
      },
      {
        key: 'semester',
        required: true,
        label: '기재 영역 · 학기',
        placeholder: '학기 선택',
      },
      {
        key: 'recordType',
        required: true,
        label: '기재 영역 · 창체 또는 세특',
        placeholder: '기재 유형 선택',
      },
      {
        key: 'recordArea',
        required: true,
        label: '기재 영역 · 활동 영역 또는 교과명',
        placeholder: '활동 영역 선택 또는 과목명 입력',
      },
      {
        key: 'schoolContext',
        required: true,
        label: '교내/과목 맥락',
        placeholder:
          '예) 과학 수행평가로 단원에서 키워드 선택하여 자율 보고서 작성',
        fullWidth: true,
      },
    ],
  },
  {
    title: '활동 내용',
    description: '',
    hideHeading: true,
    fields: [
      {
        key: 'topic',
        required: true,
        label: '탐구 주제',
        guide:
          '무엇을 탐구했는지, 어디까지 살펴보았는지, 어떤 방법과 결과물로 정리했는지가 드러나도록 작성해 주세요. 핵심 키워드 → 탐구 범위 → 탐구 방법과 결과물 순서로 한 문장을 만들어 보세요.',
        placeholder:
          '탐구 키워드 · 탐구 범위 · 탐구 형태가 포함된 한 문장으로 작성해주세요.',
        example:
          '예) 미세 플라스틱(탐구 키워드)의 수계 유입 경로와 농도 변화(탐구 범위)를 문헌 분석과 데이터 비교를 통해 분석한 보고서 작성(탐구 형태)',
        fullWidth: true,
      },
      {
        key: 'record',
        required: true,
        label: '탐구 내용',
        description:
          '*세특 원문일 수도 있으며, 탐구를 재현할 수 있을 정도로 작성해주세요.',
        placeholder:
          '탐구 기획 배경, 방법, 주요 과정과 결과를 자유롭게 작성해주세요.',
        multiline: true,
        fullWidth: false,
      },
      {
        key: 'competencies',
        required: true,
        label: '탐구의 주안점 (역량)',
        guide:
          '이 활동에서 가장 공들인 부분과 그 과정에서 드러난 역량을 연결해 주세요. 역량 이름만 나열하기보다 어떤 행동이나 판단으로 문제 해결력, 분석력, 협업 능력 등을 보여 주었는지 구체적으로 적어 보세요.',
        placeholder:
          '이 탐구에서 특히 집중했던 부분과 드러내고자 했던 역량을 한 문장으로 작성해주세요.',
        example:
          '예) 실제 실험을 학교 환경에서 재현할 수 있도록 실험 설계 과정을 구체화하여 문제 해결 능력을 드러냄.',
        multiline: true,
        fullWidth: false,
      },
    ],
  },
  {
    title: '탐구 과정',
    description:
      '*탐구를 기획하고 수행하여 결과를 도출하기까지의 과정을 순서대로 기록해 주세요.\n*결과뿐 아니라 선택의 이유, 시행착오와 해결 과정을 자세히 남기면 학생이 자신의 탐구를 설계하고 발전시키는 데 도움이 됩니다. \n*기록한 과정은 멘토별 AI에도 반영하여, 멘토의 경험과 사고방식을 바탕으로 학생에게 구체적인 도움을 제공할 예정입니다.',
    columns: 3,
    fields: [
      {
        key: 'motivation',
        label: '1. 기획 (주제 선정)',
        required: true,
        placeholder:
          '탐구 주제를 선정하게 된 계기, 내면적 동기, 주제를 선정하기 위해 고민한 과정, 이전 활동과의 연계성, 평소 관심사 등을 자세하게 작성해주세요.',
        guide:
          '처음부터 주제가 명확하지 않았어도 괜찮습니다. 출발점이 된 궁금증이나 과제, 떠올렸던 후보와 비교 기준, 선택하거나 제외한 이유를 돌아보세요. 관심사·이전 경험과의 연결, 탐구 가능성을 고려해 질문과 범위를 바꾼 과정 등 자신의 기획에 해당하는 내용을 중심으로 작성해 주세요.',
        multiline: true,
        fullWidth: false,
      },
      {
        key: 'story',
        label: '2. 수행 (구체화와 이행)',
        required: true,
        placeholder:
          '탐구를 진행하면서 마주한 어려움과 이를 극복한 과정, 주제를 심화하기 위해 추가로 설계·준비한 내용, 이론을 확장하기 위해 활용한 방법 등을 작성해 주세요.',
        guide:
          '실제로 수행한 순서와 방법, 어려움을 해결하기 위해 바꾼 점을 구체적으로 기록해 주세요.',
        multiline: true,
        fullWidth: false,
      },
      {
        key: 'result',
        label: '3. 결과 (발표 또는 보고서 등)',
        required: true,
        placeholder:
          '최종 결과물의 형태(보고서/발표 등), 주요 내용과 동료 또는 선생님의 평가나 피드백을 작성해 주세요.',
        guide:
          '결과물에서 확인한 핵심 결론과 근거, 받은 피드백과 그에 따른 보완점을 기록해 주세요.',
        multiline: true,
        fullWidth: false,
      },
    ],
  },
  {
    title: '성장 (후속 연계)',
    description: '',
    hideHeading: true,
    fields: [
      {
        key: 'followup',
        label: '성장 (후속 연계)',
        optional: true,
        description:
          '*이 탐구를 통해 배운 점, 드러난 성장, 이후 이어지는 활동이나 탐구로의 연계가 있다면 작성해 주세요.\n*후속 연계 활동이 있는 경우 해당 활동의 학년·학기·영역을 명시해 주세요. 해당 활동도 주요 탐구라면 새로운 탐구활동 블록으로 추가해 주세요.',
        placeholder:
          '이해한 탐구를 계기로 ○○에 대한 관점이 확장되어 후속 탐구를 진행함 / 관련 진로 탐색 활동으로 이어짐.',
        guide:
          '탐구 전후 생각이나 역량이 어떻게 달라졌는지, 다음 활동에서 무엇을 더 알아보고 싶은지 설명해 주세요.',
        multiline: true,
      },
    ],
  },
] as const satisfies {
  title: string;
  description: string;
  hideHeading?: boolean;
  columns?: number;
  fields: {
    key: string;
    label: string;
    placeholder: string;
    description?: string;
    guide?: string;
    example?: string;
    fullWidth?: boolean;
    required?: boolean;
    optional?: boolean;
    multiline?: boolean;
    options?: string[];
  }[];
}[];

type FieldKey = (typeof groups)[number]['fields'][number]['key'];
export type ActivityReference = {
  clientKey: string;
  title: string;
  selection: string;
  usage: string;
};
export type Activity = {
  clientKey: number;
  reports?: { clientKey: string; file: File }[];
  values: Record<FieldKey, string> & {
    references: ActivityReference[];
  };
};
export const emptyValues = (): Activity['values'] => ({
  grade: '',
  semester: '',
  recordType: '',
  recordArea: '',
  schoolContext: '',
  topic: '',
  record: '',
  story: '',
  motivation: '',
  followup: '',
  competencies: '',
  result: '',
  references: [],
});
