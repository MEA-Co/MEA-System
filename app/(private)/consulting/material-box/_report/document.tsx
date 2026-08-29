import type { DocumentProps } from '@react-pdf/renderer';
import {
  Document,
  Font,
  Link as PdfLink,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { ReactElement, ReactNode } from 'react';

import type { MaterialBoxProgressScreenData } from '@/app/(private)/consulting/material-box/_lib/types';
import {
  createExplorationReportSections,
  type MaterialBoxExplorationReportSection,
} from '@/app/(private)/consulting/material-box/_report/exploration';
import type { KeywordSuggestion } from '@/app/(private)/consulting/material-box/_tools/GenerateKeywordSuggestionsTool';

const serverProcess = (
  globalThis as typeof globalThis & {
    process?: { cwd?: () => string };
  }
).process;
const fontBasePath = serverProcess?.cwd
  ? `${serverProcess.cwd()}/public/fonts`
  : '/fonts';

Font.register({
  family: 'Pretendard',
  fonts: [
    {
      src: `${fontBasePath}/Pretendard-Regular.otf`,
      fontWeight: 400,
    },
    {
      src: `${fontBasePath}/Pretendard-SemiBold.otf`,
      fontWeight: 600,
    },
    {
      src: `${fontBasePath}/Pretendard-Bold.otf`,
      fontWeight: 700,
    },
  ],
});

const colors = {
  ink: '#0F172A',
  navy: '#020617',
  blue: '#2563EB',
  blueDark: '#1D4ED8',
  blueSoft: '#EFF6FF',
  blueBorder: '#DBEAFE',
  slate: '#64748B',
  slateLight: '#F8FAFC',
  border: '#E2E8F0',
  paper: '#FFFFFF',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingRight: 42,
    paddingBottom: 50,
    paddingLeft: 42,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontFamily: 'Pretendard',
    fontSize: 9,
    lineHeight: 1.55,
  },
  footerRule: {
    position: 'absolute',
    right: 42,
    bottom: 35,
    left: 42,
    borderTopWidth: 0.7,
    borderTopColor: colors.border,
  },
  footerLabel: {
    position: 'absolute',
    bottom: 22,
    left: 42,
    color: colors.slate,
    fontSize: 7,
  },
  hero: {
    borderRadius: 11,
    backgroundColor: colors.navy,
    paddingTop: 27,
    paddingRight: 28,
    paddingBottom: 25,
    paddingLeft: 28,
    color: '#FFFFFF',
  },
  heroEyebrow: {
    color: '#93C5FD',
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.35,
  },
  heroTitle: {
    marginTop: 13,
    fontSize: 23,
    fontWeight: 700,
    lineHeight: 1.25,
  },
  heroDescription: {
    marginTop: 10,
    color: '#CBD5E1',
    fontSize: 9,
    lineHeight: 1.65,
  },
  heroSummary: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 7,
    borderTopWidth: 0.6,
    borderTopColor: '#334155',
    paddingTop: 12,
  },
  heroSummaryPill: {
    borderRadius: 12,
    backgroundColor: '#172554',
    paddingTop: 5,
    paddingRight: 10,
    paddingBottom: 5,
    paddingLeft: 10,
    color: '#DBEAFE',
    fontSize: 7.5,
    fontWeight: 600,
  },
  sectionHeading: {
    marginTop: 24,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionNumber: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.blueSoft,
    color: colors.blueDark,
    paddingTop: 7,
    fontSize: 8,
    fontWeight: 700,
    textAlign: 'center',
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: 700,
  },
  majorCard: {
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 0.8,
    borderColor: colors.border,
    borderRadius: 10,
  },
  majorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.slateLight,
    padding: 13,
  },
  majorIdentity: {
    width: 126,
  },
  majorRank: {
    color: colors.blue,
    fontSize: 6.8,
    fontWeight: 700,
    letterSpacing: 0.7,
  },
  majorName: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 11,
    fontWeight: 700,
  },
  keywordBox: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 0.7,
    borderColor: colors.border,
    borderRadius: 7,
    backgroundColor: colors.paper,
    paddingTop: 8,
    paddingRight: 10,
    paddingBottom: 8,
    paddingLeft: 10,
  },
  fieldLabel: {
    color: colors.slate,
    fontSize: 6.5,
    fontWeight: 700,
    letterSpacing: 0.45,
  },
  keywordValue: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 9,
    fontWeight: 700,
    lineHeight: 1.5,
  },
  suggestions: {
    borderTopWidth: 0.7,
    borderTopColor: colors.border,
    padding: 13,
  },
  suggestionsTitle: {
    color: colors.blueDark,
    fontSize: 7.5,
    fontWeight: 700,
  },
  suggestionGrid: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  suggestionCard: {
    width: 228,
    borderWidth: 0.7,
    borderColor: colors.blueBorder,
    borderRadius: 8,
    backgroundColor: '#F7FAFF',
    padding: 10,
  },
  suggestionKeyword: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    backgroundColor: colors.blue,
    paddingTop: 4,
    paddingRight: 7,
    paddingBottom: 4,
    paddingLeft: 7,
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: 700,
  },
  suggestionDescription: {
    marginTop: 7,
    color: '#475569',
    fontSize: 7.5,
    lineHeight: 1.6,
  },
  suggestionLinks: {
    marginTop: 6,
    gap: 3,
  },
  suggestionLink: {
    color: colors.blueDark,
    fontSize: 6.5,
    fontWeight: 600,
    textDecoration: 'none',
  },
  directKeyword: {
    marginTop: 6,
    color: colors.slate,
    fontSize: 7.5,
  },
  explorationCard: {
    marginBottom: 12,
    borderWidth: 0.8,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
  },
  explorationDepartment: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: 700,
  },
  explorationOverview: {
    marginTop: 6,
    color: '#475569',
    fontSize: 8,
    lineHeight: 1.65,
  },
  explorationSubheading: {
    marginTop: 12,
    color: colors.blueDark,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.45,
  },
  explorationList: {
    marginTop: 5,
    gap: 4,
  },
  explorationListItem: {
    color: '#475569',
    fontSize: 7.5,
    lineHeight: 1.55,
  },
  schoolExampleBox: {
    marginTop: 10,
    borderRadius: 7,
    backgroundColor: colors.blueSoft,
    padding: 10,
  },
  goalBox: {
    marginTop: 12,
    borderRadius: 8,
    backgroundColor: colors.navy,
    padding: 12,
    color: '#FFFFFF',
  },
  goalLabel: {
    color: '#93C5FD',
    fontSize: 6.5,
    fontWeight: 700,
    letterSpacing: 0.5,
  },
  goalValue: {
    marginTop: 6,
    fontSize: 8.5,
    fontWeight: 600,
    lineHeight: 1.65,
  },
  profileGrid: {
    marginTop: 9,
    flexDirection: 'row',
    gap: 7,
  },
  profileCard: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 0.7,
    borderColor: colors.blueBorder,
    borderRadius: 7,
    backgroundColor: '#F7FAFF',
    padding: 9,
  },
  profileLabel: {
    color: colors.blueDark,
    fontSize: 6.2,
    fontWeight: 700,
  },
  profileValue: {
    marginTop: 4,
    color: colors.ink,
    fontSize: 8,
    fontWeight: 700,
  },
  profileDescription: {
    marginTop: 4,
    color: '#475569',
    fontSize: 6.8,
    lineHeight: 1.5,
  },
  profileEvidence: {
    marginTop: 5,
    borderTopWidth: 0.5,
    borderTopColor: colors.blueBorder,
    paddingTop: 4,
    color: colors.slate,
    fontSize: 6.2,
    lineHeight: 1.45,
  },
  transcript: {
    marginTop: 10,
    borderTopWidth: 0.7,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  transcriptTurn: {
    marginBottom: 5,
    flexDirection: 'row',
    gap: 7,
  },
  transcriptRole: {
    width: 42,
    color: colors.blueDark,
    fontSize: 6.5,
    fontWeight: 700,
  },
  transcriptContent: {
    flexGrow: 1,
    flexBasis: 0,
    color: '#475569',
    fontSize: 6.8,
    lineHeight: 1.55,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 9,
  },
  directionCard: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 0.8,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 15,
  },
  directionCardBlue: {
    borderColor: colors.blueBorder,
    backgroundColor: colors.blueSoft,
  },
  cardLabel: {
    color: colors.blueDark,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.65,
  },
  cardValue: {
    marginTop: 9,
    color: colors.ink,
    fontSize: 9,
    fontWeight: 600,
    lineHeight: 1.7,
  },
  strengthCard: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 0.8,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 13,
  },
  strengthValue: {
    marginTop: 8,
    color: '#334155',
    fontSize: 8,
    lineHeight: 1.65,
  },
});

function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionNumber}>{number}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function SuggestionCard({
  suggestion,
}: {
  suggestion: KeywordSuggestion;
}) {
  return (
    <View style={styles.suggestionCard}>
      <Text style={styles.suggestionKeyword}>{suggestion.keyword}</Text>
      <Text style={styles.suggestionDescription}>{suggestion.description}</Text>
      <View style={styles.suggestionLinks}>
        {suggestion.links.map((link, index) => (
          <PdfLink
            key={`${link.url}-${index}`}
            src={link.url}
            style={styles.suggestionLink}
          >
            {link.title}
          </PdfLink>
        ))}
      </View>
    </View>
  );
}

function MajorCard({
  entry,
  index,
}: {
  entry: MaterialBoxProgressScreenData['majorKeywords'][number];
  index: number;
}) {
  return (
    <View style={styles.majorCard} wrap={false}>
      <View style={styles.majorHeader}>
        <View style={styles.majorIdentity}>
          <Text style={styles.majorRank}>{index + 1}순위 희망 전공</Text>
          <Text style={styles.majorName}>{entry.major}</Text>
        </View>
        <View style={styles.keywordBox}>
          <Text style={styles.fieldLabel}>최종 작성 키워드</Text>
          <Text style={styles.keywordValue}>{entry.keyword}</Text>
        </View>
      </View>
      <View style={styles.suggestions}>
        <Text style={styles.suggestionsTitle}>
          {entry.explorationState
            ? '탐구 대화로 정리한 키워드'
            : 'MEA의 추천 키워드'}
        </Text>
        {entry.selectedSuggestions.length > 0 ? (
          <View style={styles.suggestionGrid}>
            {entry.selectedSuggestions.map((suggestion, suggestionIndex) => (
              <SuggestionCard
                key={`${suggestion.keyword}-${suggestionIndex}`}
                suggestion={suggestion}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.directKeyword}>
            {entry.explorationState
              ? '전공 탐구 코치와의 대화에서 출발해 학생이 확인하고 수정한 키워드입니다.'
              : '추천 항목을 선택하지 않고 직접 작성한 키워드입니다.'}
          </Text>
        )}
      </View>
    </View>
  );
}

function ExplorationDetail({
  section,
}: {
  section: MaterialBoxExplorationReportSection;
}) {
  const { state, goalStatement, profileItems } = section;
  const departmentMap = state.departmentMap;

  return (
    <View style={styles.explorationCard}>
      <Text style={styles.explorationDepartment}>{state.department}</Text>
      {departmentMap ? (
        <>
          <Text style={styles.explorationOverview}>
            {departmentMap.overview}
          </Text>
          <Text style={styles.explorationSubheading}>
            일반적인 주요 분야
          </Text>
          <View style={styles.explorationList}>
            {departmentMap.fields.map((field) => (
              <Text key={field.fieldName} style={styles.explorationListItem}>
                • {field.fieldName} — {field.explanation} (
                {field.keywords.map((item) => item.keyword).join(' · ')})
              </Text>
            ))}
          </View>
          <View style={styles.schoolExampleBox}>
            <Text style={styles.explorationSubheading}>학교 맥락의 연결 예시</Text>
            <View style={styles.explorationList}>
              {departmentMap.schoolContextExamples.map((example) => (
                <Text key={example} style={styles.explorationListItem}>
                  • {example}
                </Text>
              ))}
            </View>
          </View>
        </>
      ) : null}

      <View style={styles.goalBox} wrap={false}>
        <Text style={styles.goalLabel}>최종 탐구 목표</Text>
        <Text style={styles.goalValue}>{goalStatement}</Text>
      </View>

      <View style={styles.profileGrid} wrap={false}>
        {profileItems.map(({ title, trait }) => (
          <View key={title} style={styles.profileCard}>
            <Text style={styles.profileLabel}>{title}</Text>
            <Text style={styles.profileValue}>{trait.label}</Text>
            <Text style={styles.profileDescription}>{trait.description}</Text>
            <Text style={styles.profileEvidence}>근거 · {trait.evidence}</Text>
          </View>
        ))}
      </View>

      <View style={styles.transcript}>
        <Text style={styles.explorationSubheading}>
          학생과 탐구 코치의 전체 대화
        </Text>
        <View style={styles.explorationList}>
          {state.conversation.map((turn, index) => (
            <View key={`${turn.role}-${index}`} style={styles.transcriptTurn}>
              <Text style={styles.transcriptRole}>
                {turn.role === 'student' ? '학생' : '탐구 코치'}
              </Text>
              <Text style={styles.transcriptContent}>{turn.content}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function DirectionCard({
  label,
  value,
  blue = false,
}: {
  label: string;
  value: string;
  blue?: boolean;
}) {
  return (
    <View
      style={
        blue
          ? [styles.directionCard, styles.directionCardBlue]
          : styles.directionCard
      }
    >
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

function StrengthCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.strengthCard}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.strengthValue}>{value}</Text>
    </View>
  );
}

function KeepTogether({ children }: { children: ReactNode }) {
  return <View wrap={false}>{children}</View>;
}

export function createMaterialBoxReportDocument(
  report: MaterialBoxProgressScreenData,
): ReactElement<DocumentProps> {
  const explorationSections = createExplorationReportSections(report);

  return (
    <Document
      title="나의 재료함 리포트"
      author="MEA"
      subject="생활기록부 브랜딩 컨설팅 재료함 설계 결과"
      language="ko-KR"
      creator="MEA Consulting"
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.footerRule} fixed />
        <Text style={styles.footerLabel} fixed>
          나의 재료함 리포트
        </Text>
        <View style={styles.hero} wrap={false}>
          <Text style={styles.heroEyebrow}>MEA</Text>
          <Text style={styles.heroTitle}>나의 재료함</Text>
        </View>

        <KeepTogether>
          <SectionHeading number="01" title="전공별 세부 키워드" />
          <MajorCard entry={report.majorKeywords[0]} index={0} />
        </KeepTogether>
        {report.majorKeywords.slice(1).map((entry, index) => (
          <MajorCard
            key={`${entry.major}-${index}`}
            entry={entry}
            index={index + 1}
          />
        ))}

        {explorationSections.length > 0 ? (
          <>
            <SectionHeading number="02" title="전공 탐구 대화 결과" />
            {explorationSections.map((section, index) => (
              <ExplorationDetail
                key={`${section.state.department}-${index}`}
                section={section}
              />
            ))}
          </>
        ) : null}

        <KeepTogether>
          <SectionHeading
            number={explorationSections.length > 0 ? '03' : '02'}
            title="나의 탐구 방향"
          />
          <View style={styles.cardRow}>
            <DirectionCard
              blue
              label="학생 스토리"
              value={
                report.studentStory ?? '아직 저장된 학생 스토리가 없습니다.'
              }
            />
            <DirectionCard
              label="전공 가치관"
              value={report.coreValue ?? '아직 저장된 전공 가치관이 없습니다.'}
            />
          </View>
        </KeepTogether>

        <KeepTogether>
          <SectionHeading
            number={explorationSections.length > 0 ? '04' : '03'}
            title="나의 계열 적합 역량"
          />
          <View style={styles.cardRow}>
            <StrengthCard
              label="순수 계열 적합 역량"
              value={report.fieldStrength ?? '아직 저장된 역량이 없습니다.'}
            />
            <StrengthCard
              label="전공 계열 적합 역량"
              value={
                report.majorFieldStrength ?? '아직 저장된 역량이 없습니다.'
              }
            />
            <StrengthCard
              label="차별화 역량"
              value={report.personalStrength ?? '아직 저장된 역량이 없습니다.'}
            />
          </View>
        </KeepTogether>

      </Page>
    </Document>
  );
}
