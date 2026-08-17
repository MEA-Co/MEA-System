import type { MentorAdvice } from '@/features/material-box-consulting/model/types';

export const mentorAdviceFixtures: ReadonlyArray<MentorAdvice> = [
  {
    id: 'computer-vr-ar',
    question: 'mentor-interests',
    mentorName: '김민준 멘토',
    mentorMajor: '컴퓨터공학과',
    message:
      '저는 컴퓨터가 현실의 경험을 어떻게 확장할 수 있는지 궁금해서 VR과 AR에 관심을 가졌어요. 수업에서 배운 그래픽과 센서 기술을 가상현실 경험으로 연결해봤습니다.',
    keyword: 'VR/AR',
  },
  {
    id: 'computer-ai-search',
    question: 'mentor-interests',
    mentorName: '박서윤 멘토',
    mentorMajor: '컴퓨터공학과',
    message:
      '저는 필요한 정보를 더 정확하게 찾아주는 기술에 관심이 있었어요. 그래서 인공지능이 사용자의 의도를 이해하는 검색 모델을 저만의 세부 주제로 삼았습니다.',
    keyword: '인공지능 검색 모델',
  },
  {
    id: 'computer-data',
    question: 'keyword-help',
    mentorName: '이도현 멘토',
    mentorMajor: '컴퓨터공학과',
    message:
      '아직 한 분야를 고르기 어렵다면 어디에서나 활용할 수 있는 데이터부터 살펴보세요. 관심 있는 현상의 데이터를 모으고 분석하는 과정은 다양한 전공 주제로 확장할 수 있습니다.',
    keyword: '데이터 분석',
  },
  {
    id: 'linguistics-language-society',
    question: 'keyword-help',
    mentorName: '최하린 멘토',
    mentorMajor: '언어학과',
    message:
      '평소 자주 듣는 말이나 온라인에서 달라지는 표현부터 관찰해보세요. 일상의 언어가 사람과 사회에 어떤 영향을 주는지 궁금해하는 것만으로도 좋은 출발점이 됩니다.',
    keyword: '언어와 사회',
  },
];
