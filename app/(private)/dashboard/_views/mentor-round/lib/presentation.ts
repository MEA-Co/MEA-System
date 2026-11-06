import type { Ballot, SourcePair } from './rounds';

// Display names only: saved component IDs, labels, versions and sources stay intact.
const strategyLabels: Record<string, string> = {
  '난도별 학습 수단 선택': '난이도에 맞는 공부 방법 고르기',
  '문제로 개념 진단': '문제로 개념 이해 확인하기',
  '과업 집중기 분량 조절': '할 일이 몰릴 때 공부량 조절하기',
  '주말 취약점 보완': '주말에 부족한 부분 채우기',
  '조사·독서 후 산출물 정리': '조사·독서 내용을 발표나 보고서로 정리하기',
  '수업 밖 자기 학습': '수업 외에 혼자 공부하기',
  '진로 연계 후속 탐구': '진로와 연결해 다음 탐구 이어가기',
  '후속 탐구 연결 명시': '이전 탐구와 이어지는 부분 보여주기',
  '개념 적용 확인 후 심화': '개념을 적용해 본 뒤 심화하기',
  '주간 계획 회고': '한 주의 계획 돌아보기',
  '교과 밖 탐구 사전 협의': '교과 밖 탐구는 미리 상의하기',
  '지역 관점 자료 활용': '지역의 시각이 담긴 자료 활용하기',
  'AI 자료 실재 확인': 'AI가 찾은 자료가 실제로 있는지 확인하기',
  '기존 탐구 한계 재설명': '이전 탐구의 한계를 다시 설명하기',
  '활동 후 성찰': '활동 뒤에 느낀 점 돌아보기',
  '시험 전 정리 자료 회독': '시험 전에 정리한 자료 다시 읽기',
  '학년 간 활동 연결 기록': '학년이 바뀌어도 이어진 활동 기록하기',
};
export function strategyLabel(label: string) {
  return strategyLabels[label] ?? label;
}

export const choiceColors = [
  '#228463',
  '#c68b2e',
  '#627ebb',
  '#985789',
  '#798646',
];

// Keep small option letters above WCAG AA contrast on the existing palette.
export function choiceLabelStyle(choice: number) {
  return {
    background: choiceColors[choice] ?? '#666666',
    color: [1, 2, 4].includes(choice) ? '#101010' : '#ffffff',
  };
}

export function choiceLetter(choice: number) {
  return choice < 0 ? '—' : String.fromCharCode(65 + choice);
}

// Preserve the response text. Paragraph spacing is presentation, not a new summary.
export function explanationParagraphs(reason?: string) {
  return (reason ?? '')
    .split(/\n\s*\n|\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function strategyApplications(ballot: Ballot) {
  // v2 has bookkeeping; v3 folds the strategy into the advice itself.
  if (ballot.explanation && ballot.explanation.version !== '1') return [];
  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
  const reason = normalize(ballot.reason ?? '');
  return Array.from(
    new Set(
      (ballot.applied ?? [])
        .map((tag) => tag.evidence?.trim())
        .filter(
          (text): text is string =>
            Boolean(text) && !reason.includes(normalize(text!)),
        ),
    ),
  );
}

// Use the saved, source-linked summary, never today's catalog or new model prose.
export function referencedSummaries(ballot: Ballot) {
  const refs = new Set(ballot.applied?.flatMap((tag) => tag.sourceRefs ?? []));
  return [
    ...new Set(
      (ballot.sources ?? [])
        .filter((source) => source.id && refs.has(source.id))
        .map((source) => source.summary.trim())
        .filter(Boolean),
    ),
  ];
}

export function answerParagraphs(ballot: Ballot) {
  if (ballot.explanation?.version !== '2')
    return explanationParagraphs(ballot.reason);
  if (ballot.choice === -1)
    return [
      '이 멘토의 경험만으로는 하나를 고르기 어려워요. 목표나 지금 어려운 점을 더 구체적으로 적어 보세요.',
    ];
  if (referencedSummaries(ballot).length)
    return ['함께 참고할 만한 멘토의 경험이에요.'];
  return [
    '이 질문과 직접 연결되는 멘토의 경험은 찾지 못했어요. 목표와 지금 어려운 점을 더 구체적으로 적어 보세요.',
  ];
}

export function uniqueSourcePairs(sources: SourcePair[] = []) {
  return sources.filter(
    (source, index) =>
      sources.findIndex(
        (candidate) =>
          candidate.question === source.question &&
          candidate.quote === source.quote &&
          candidate.summary === source.summary,
      ) === index,
  );
}

export function confidenceDescription(support: Ballot['support']) {
  if (support === undefined) return '아직 원문과 비교하지 않았어요';
  if (support === null) return '원문과 비교를 마치지 못했어요';
  return (
    {
      상: '원문에 직접 근거가 많아요',
      중: '일부 조언에 원문 근거가 있어요',
      하: '직접 근거보다 추론이 많아요',
    }[support.level] ?? '원문 대조 기록 확인 필요'
  );
}
