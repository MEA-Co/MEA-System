# 이전 질문지 구현 — 미사용 보존본

현재 앱과 API는 이 폴더를 참조하지 않습니다. 이전 구현 확인을 위해 파일을 보존하며, 기능 변경은 아래 경로에서 진행합니다.

- 통합 진입점: `../questions/QuestionsView.tsx`
- 질문지 화면: `../questions/components/questionnaire/`
- 질문지 저장·조회 로직: `../questions/lib/questionnaire/`
- 질문지 훅: `../questions/hooks/questionnaire/`

현재 사용하던 컴포넌트만 새 위치에 복사하고 연결을 전환했습니다. `QuestionnaireEditor.tsx`, `QuestionDetailsEditor.tsx`, `QuestionTypeEditor.tsx`는 이전 직접 작성 방식의 미사용 컴포넌트로 이곳에만 남깁니다. 같은 이름의 질문 관리용 컴포넌트는 별개의 현행 구현입니다.
