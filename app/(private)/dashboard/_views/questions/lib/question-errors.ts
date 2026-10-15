export function errorStatus(code?: string) {
  if (code === '42501') return 403;
  if (code === '40001' || code === '55000' || code === '23505') return 409;
  if (code === '22023' || code === '23503' || code === '23514') return 400;
  if (code === 'P0002') return 404;
  return 503;
}

const validationReasons: [string, string, string][] = [
  [
    'Invalid question block request',
    'document',
    '질문 전체 내용이 저장 가능한 크기(30만 자)를 넘었거나 요청 형식이 올바르지 않아요.',
  ],
  [
    'Duplicate question detail IDs',
    'details',
    '설명 항목 ID가 중복됐어요. 중복 항목을 제거해 주세요.',
  ],
  [
    'Detail belongs to another question',
    'details',
    '다른 질문에 속한 설명 항목은 사용할 수 없어요.',
  ],
  [
    'Too many question details',
    'details',
    '설명 항목은 최대 20개까지 추가할 수 있어요.',
  ],
  [
    'Invalid question detail',
    'details',
    '설명 항목의 제목·본문·공개 여부를 확인해 주세요.',
  ],
  [
    'Choice field needs 2 to 20 options',
    'fields',
    '선택형 답변에는 선택지를 2개 이상 20개 이하로 설정해 주세요.',
  ],
  [
    'Question block dependency cycle',
    'condition',
    '질문의 선후관계가 순환해요. 연결된 질문의 조건을 확인해 주세요.',
  ],
];

export function databaseValidationFields(message: string) {
  const reason = validationReasons.find(([match]) => message.includes(match));
  return reason
    ? [
        {
          path:
            reason[1] === 'document' ? ['document'] : ['document', reason[1]],
          message: reason[2],
        },
      ]
    : [];
}

export function errorMessage(message: string, status: number) {
  const validation = databaseValidationFields(message)[0];
  if (validation) return validation.message;
  if (message.includes('Published question is immutable'))
    return '배포된 질문지에 사용된 질문은 수정하거나 삭제할 수 없어요.';
  if (message.includes('Question purpose is immutable'))
    return '저장된 카드 종류는 바꿀 수 없어요. 다른 종류는 새 카드로 만들어 주세요.';
  if (
    message.includes(
      'Saved flow periods require their original layout and fixed period count',
    )
  )
    return '저장된 흐름표 응답이 있어 표시 방식이나 기본 시기 수를 바꿀 수 없어요. 시기 이름과 추가 허용 위치는 수정할 수 있습니다.';
  if (
    message.includes('Study registration cards cannot be answer dependencies')
  )
    return '학습법 등록 안내 카드는 답변 조건이나 참조 대상으로 사용할 수 없어요.';
  if (message.includes('used by a questionnaire'))
    return '질문지에 배치된 질문이에요. 해당 질문지에서 제거한 뒤 삭제해 주세요.';
  if (message.includes('dependency cycle'))
    return '질문의 선후관계가 순환해요.';
  if (message.includes('used by another block'))
    return '다른 질문이 참조하고 있어 삭제할 수 없어요.';
  if (message.includes('Referenced answer fields'))
    return '다른 질문이 참조하는 열이나 행 구성이에요. 연결된 질문의 조건과 응답 참조를 해제하고 저장한 뒤 다시 수정해 주세요.';
  if (status === 409)
    return '다른 곳에서 질문이 변경됐어요. 목록을 확인해 주세요.';
  if (status === 403) return '이 질문을 수정할 권한이 없어요.';
  if (status === 400) return '질문 설정과 참조 대상을 확인해 주세요.';
  return '질문을 처리하지 못했어요.';
}
