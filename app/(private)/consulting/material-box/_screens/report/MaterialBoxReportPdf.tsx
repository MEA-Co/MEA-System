import {
  Circle,
  Document,
  Font,
  Link,
  Page,
  Path,
  pdf,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer';

import { exampleMaterialBoxReport as engineeringReport } from '@/app/(private)/consulting/material-box/_screens/report/example-report';
import { humanitiesExampleMaterialBoxReport as humanitiesReport } from '@/app/(private)/consulting/material-box/_screens/report/humanities-example-report';

export type MaterialBoxReportType = 'engineering' | 'humanities';

type MaterialBoxReportData = typeof engineeringReport | typeof humanitiesReport;

const reports: Record<MaterialBoxReportType, MaterialBoxReportData> = {
  engineering: engineeringReport,
  humanities: humanitiesReport,
};

Font.register({
  family: 'Pretendard',
  fonts: [
    { src: '/fonts/Pretendard-Regular.otf', fontWeight: 400 },
    { src: '/fonts/Pretendard-SemiBold.otf', fontWeight: 600 },
    { src: '/fonts/Pretendard-Bold.otf', fontWeight: 700 },
  ],
});

Font.registerHyphenationCallback((word) => [...word]);

const colors = {
  ink: '#0f172a',
  text: '#334155',
  muted: '#64748b',
  line: '#dbe3ee',
  pale: '#f8fafc',
  blue: '#2563eb',
  bluePale: '#eff6ff',
  white: '#ffffff',
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.white,
    color: colors.text,
    fontFamily: 'Pretendard',
    fontSize: 8.5,
    lineHeight: 1.6,
    paddingTop: 38,
    paddingRight: 38,
    paddingBottom: 45,
    paddingLeft: 38,
  },
  reportHeader: {
    backgroundColor: colors.ink,
    color: colors.white,
    marginTop: -38,
    marginRight: -38,
    marginBottom: 0,
    marginLeft: -38,
    paddingTop: 38,
    paddingRight: 42,
    paddingBottom: 30,
    paddingLeft: 42,
  },
  headerEyebrow: {
    color: '#93c5fd',
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.5,
  },
  headerTitle: {
    marginTop: 22,
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.35,
  },
  headerMeta: {
    borderTopColor: '#334155',
    borderTopWidth: 1,
    display: 'flex',
    flexDirection: 'row',
    marginTop: 25,
    paddingTop: 14,
  },
  headerMetaItem: {
    width: '50%',
  },
  headerMetaLabel: {
    color: '#94a3b8',
    fontSize: 7.5,
  },
  headerMetaValue: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 600,
    marginTop: 3,
  },
  section: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    marginRight: -38,
    marginLeft: -38,
    paddingTop: 24,
    paddingRight: 38,
    paddingBottom: 24,
    paddingLeft: 38,
  },
  sectionHeader: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
    marginBottom: 18,
  },
  sectionIcon: {
    alignItems: 'center',
    backgroundColor: colors.bluePale,
    borderRadius: 10,
    display: 'flex',
    height: 34,
    justifyContent: 'center',
    marginRight: 11,
    width: 34,
  },
  sectionEyebrow: {
    color: colors.blue,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 1.2,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: 700,
    marginTop: 2,
  },
  card: {
    borderColor: colors.line,
    borderRadius: 9,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  subtleCard: {
    backgroundColor: colors.pale,
    borderColor: colors.line,
    borderRadius: 9,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  blueCard: {
    backgroundColor: colors.bluePale,
    borderColor: '#dbeafe',
    borderRadius: 9,
    borderWidth: 1,
    marginBottom: 10,
    padding: 14,
  },
  rank: {
    color: colors.blue,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.8,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 10.5,
    fontWeight: 700,
    marginTop: 2,
  },
  label: {
    color: colors.blue,
    fontSize: 7,
    fontWeight: 700,
    marginBottom: 3,
    marginTop: 8,
  },
  body: {
    color: colors.text,
    fontSize: 8.2,
  },
  majorCard: {
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 13,
    overflow: 'hidden',
  },
  majorHeader: {
    alignItems: 'center',
    backgroundColor: colors.pale,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    display: 'flex',
    flexDirection: 'row',
    padding: 12,
  },
  majorRankCircle: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 12,
    display: 'flex',
    height: 24,
    justifyContent: 'center',
    marginRight: 9,
    width: 24,
  },
  majorRankNumber: {
    color: colors.white,
    fontSize: 7.5,
    fontWeight: 700,
  },
  majorBodyRow: {
    display: 'flex',
    flexDirection: 'row',
  },
  majorColumn: {
    padding: 12,
    width: '50%',
  },
  majorColumnLeft: {
    borderRightColor: colors.line,
    borderRightWidth: 1,
  },
  sourcePills: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 7,
  },
  sourcePill: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    color: '#475569',
    fontSize: 6.4,
    fontWeight: 600,
    marginBottom: 4,
    marginRight: 4,
    paddingBottom: 3,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 3,
    textDecoration: 'none',
  },
  candidates: {
    borderTopColor: '#f1f5f9',
    borderTopWidth: 1,
    color: '#475569',
    fontSize: 7.2,
    marginTop: 8,
    paddingTop: 7,
  },
  avatarRow: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
    marginTop: 8,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    borderRadius: 14,
    display: 'flex',
    height: 28,
    justifyContent: 'center',
    marginRight: 8,
    width: 28,
  },
  avatarMuted: {
    backgroundColor: '#f1f5f9',
  },
  avatarLetter: {
    color: '#1d4ed8',
    fontSize: 9,
    fontWeight: 700,
  },
  mentorName: {
    color: colors.ink,
    fontSize: 8.2,
    fontWeight: 700,
  },
  mentorAffiliation: {
    color: colors.muted,
    fontSize: 6.5,
    marginTop: 1,
  },
  mentorAdvice: {
    color: colors.text,
    borderLeftColor: '#bfdbfe',
    borderLeftWidth: 2,
    fontSize: 7.6,
    marginTop: 8,
    paddingLeft: 7,
  },
  selectedRow: {
    backgroundColor: '#f5f9ff',
    borderTopColor: colors.line,
    borderTopWidth: 1,
    padding: 12,
  },
  chips: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  chip: {
    backgroundColor: colors.blue,
    borderRadius: 10,
    color: colors.white,
    fontSize: 7,
    fontWeight: 600,
    marginBottom: 4,
    marginRight: 5,
    paddingBottom: 3,
    paddingLeft: 7,
    paddingRight: 7,
    paddingTop: 3,
  },
  valueStatement: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.5,
  },
  gridRow: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  halfCard: {
    width: '49%',
  },
  thirdCard: {
    width: '32%',
  },
  evidence: {
    backgroundColor: colors.pale,
    borderRadius: 6,
    marginTop: 8,
    padding: 8,
  },
  strategyBasis: {
    color: colors.blue,
    fontSize: 6.5,
    marginTop: 5,
  },
  strategyRow: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'row',
  },
  strategyNumber: {
    width: '7%',
  },
  strategyTitle: {
    paddingRight: 10,
    width: '36%',
  },
  strategyDescription: {
    width: '57%',
  },
  oneLineBrand: {
    backgroundColor: colors.blue,
    color: colors.white,
    marginRight: -38,
    marginLeft: -38,
    paddingTop: 25,
    paddingRight: 42,
    paddingBottom: 26,
    paddingLeft: 42,
  },
  oneLineLabel: {
    color: '#dbeafe',
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 1.1,
  },
  oneLineText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: 700,
    lineHeight: 1.45,
    marginTop: 10,
  },
  roadmapGoal: {
    backgroundColor: colors.ink,
    borderRadius: 10,
    color: colors.white,
    marginBottom: 14,
    padding: 15,
  },
  roadmapGoalLabel: {
    color: '#93c5fd',
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 0.8,
  },
  roadmapGoalText: {
    color: colors.white,
    fontSize: 11.5,
    fontWeight: 600,
    marginTop: 4,
  },
  roadmapCard: {
    borderColor: colors.line,
    borderRadius: 9,
    borderWidth: 1,
    marginBottom: 8,
    padding: 12,
  },
  roadmapCardFinal: {
    backgroundColor: '#f5f9ff',
    borderColor: '#bfdbfe',
  },
  roadmapTop: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'row',
  },
  roadmapNumber: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 13,
    display: 'flex',
    height: 26,
    justifyContent: 'center',
    marginRight: 9,
    width: 26,
  },
  roadmapNumberFinal: {
    backgroundColor: colors.blue,
  },
  roadmapContent: {
    flex: 1,
  },
  deliverable: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    marginTop: 9,
    paddingTop: 8,
  },
  arrowRow: {
    color: colors.muted,
    fontSize: 7.2,
    fontWeight: 600,
    marginBottom: 7,
    marginLeft: 14,
  },
  footer: {
    bottom: 18,
    color: '#94a3b8',
    fontSize: 7,
    left: 38,
    position: 'absolute',
    right: 38,
  },
  footerPage: {
    position: 'absolute',
    right: 0,
  },
  note: {
    color: colors.muted,
    fontSize: 7,
    marginTop: 6,
  },
});

type SectionIconName =
  'compass' | 'target' | 'brain' | 'sparkles' | 'route' | 'book';

function SectionIcon({ name }: { name: SectionIconName }) {
  const common = {
    fill: 'none',
    stroke: '#1d4ed8',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.7,
  };

  return (
    <View style={styles.sectionIcon}>
      <Svg height={18} width={18} viewBox="0 0 24 24">
        {name === 'compass' ? (
          <>
            <Circle {...common} cx={12} cy={12} r={9} />
            <Path {...common} d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" />
          </>
        ) : null}
        {name === 'target' ? (
          <>
            <Circle {...common} cx={12} cy={12} r={9} />
            <Circle {...common} cx={12} cy={12} r={4} />
            <Path {...common} d="M12 12 20 4" />
          </>
        ) : null}
        {name === 'brain' ? (
          <>
            <Circle {...common} cx={7} cy={7} r={2.2} />
            <Circle {...common} cx={17} cy={7} r={2.2} />
            <Circle {...common} cx={12} cy={17} r={2.2} />
            <Path {...common} d="M8.8 8.4 10.8 15M15.2 8.4 13.2 15M9.2 7h5.6" />
          </>
        ) : null}
        {name === 'sparkles' ? (
          <>
            <Path
              {...common}
              d="m12 3 1.5 4.2L18 9l-4.5 1.8L12 15l-1.5-4.2L6 9l4.5-1.8L12 3Z"
            />
            <Path
              {...common}
              d="m19 15 .7 2.1L22 18l-2.3.9L19 21l-.7-2.1L16 18l2.3-.9L19 15Z"
            />
          </>
        ) : null}
        {name === 'route' ? (
          <>
            <Circle {...common} cx={6} cy={6} r={2} />
            <Circle {...common} cx={18} cy={18} r={2} />
            <Path {...common} d="M8 6h5a3 3 0 0 1 0 6h-2a3 3 0 0 0 0 6h5" />
          </>
        ) : null}
        {name === 'book' ? (
          <>
            <Path
              {...common}
              d="M4 5.5A3.5 3.5 0 0 1 7.5 4H11v15H7.5A3.5 3.5 0 0 0 4 20V5.5Z"
            />
            <Path
              {...common}
              d="M20 5.5A3.5 3.5 0 0 0 16.5 4H13v15h3.5A3.5 3.5 0 0 1 20 20V5.5Z"
            />
          </>
        ) : null}
      </Svg>
    </View>
  );
}

function SectionHeader({
  number,
  eyebrow,
  title,
  icon,
}: {
  number: string;
  eyebrow: string;
  title: string;
  icon: SectionIconName;
}) {
  return (
    <View style={styles.sectionHeader} minPresenceAhead={230}>
      <SectionIcon name={icon} />
      <View>
        <Text style={styles.sectionEyebrow}>
          {number} · {eyebrow}
        </Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
    </View>
  );
}

function MentorIdentity({
  name,
  affiliation,
  muted = false,
}: {
  name: string;
  affiliation: string;
  muted?: boolean;
}) {
  return (
    <View style={styles.avatarRow}>
      <View style={[styles.avatar, muted ? styles.avatarMuted : {}]}>
        <Text style={styles.avatarLetter}>{name.slice(0, 1)}</Text>
      </View>
      <View>
        <Text style={styles.mentorName}>{name} 멘토</Text>
        <Text style={styles.mentorAffiliation}>{affiliation}</Text>
      </View>
    </View>
  );
}

function Footer({ studentName }: { studentName: string }) {
  return (
    <View fixed style={styles.footer}>
      <Text>MEA · {studentName} 학생 재료함 설계 리포트</Text>
      <Text
        style={styles.footerPage}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

export function MaterialBoxReportDocument({
  report,
}: {
  report: MaterialBoxReportData;
}) {
  return (
    <Document
      title={`${report.persona.name} 생활기록부 브랜딩 컨설팅 [재료함 설계]`}
      author="MEA"
      subject="재료함 설계 예시 리포트"
      language="ko-KR"
    >
      <Page size="A4" style={styles.page} wrap>
        <Footer studentName={report.persona.name} />

        <View style={styles.reportHeader} wrap={false}>
          <Text style={styles.headerEyebrow}>MEA · CONSULTING REPORT</Text>
          <Text style={styles.headerTitle}>
            생활기록부 브랜딩 컨설팅 [재료함 설계]
          </Text>
          <View style={styles.headerMeta}>
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>학생 이름</Text>
              <Text style={styles.headerMetaValue}>{report.persona.name}</Text>
            </View>
            <View style={styles.headerMetaItem}>
              <Text style={styles.headerMetaLabel}>학년</Text>
              <Text style={styles.headerMetaValue}>{report.persona.grade}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader
            number="01"
            eyebrow="KEYWORDS"
            title="전공 세부 분야 키워드"
            icon="compass"
          />
          {report.fieldMap.map((field) => (
            <View key={field.major} style={styles.majorCard} wrap={false}>
              <View style={styles.majorHeader}>
                <View style={styles.majorRankCircle}>
                  <Text style={styles.majorRankNumber}>{field.rank}</Text>
                </View>
                <View>
                  <Text style={styles.rank}>{field.rank}순위 희망 전공</Text>
                  <Text style={styles.cardTitle}>{field.major}</Text>
                </View>
              </View>

              <View style={styles.majorBodyRow}>
                <View style={[styles.majorColumn, styles.majorColumnLeft]}>
                  <Text style={styles.label}>01 · 시스템의 탐색 지원</Text>
                  <View style={styles.sourcePills}>
                    {field.systemSupport.sources.map((source) => (
                      <Link
                        key={source.href}
                        src={source.href}
                        style={styles.sourcePill}
                      >
                        {source.label}
                      </Link>
                    ))}
                  </View>
                  <Text style={[styles.body, { marginTop: 7 }]}>
                    {field.systemSupport.summary}
                  </Text>
                  <View style={styles.candidates}>
                    <Text style={[styles.note, { marginTop: 0 }]}>
                      탐색한 후보
                    </Text>
                    <Text style={[styles.body, { marginTop: 3 }]}>
                      {field.systemSupport.candidates.join(' · ')}
                    </Text>
                  </View>
                </View>

                <View style={styles.majorColumn}>
                  <Text style={styles.label}>02 · 멘토의 전공 조언</Text>
                  <MentorIdentity
                    name={field.mentor.name}
                    affiliation={field.mentor.affiliation}
                  />
                  <Text style={styles.mentorAdvice}>
                    “{field.mentor.advice}”
                  </Text>
                </View>
              </View>

              <View style={styles.selectedRow}>
                <Text style={styles.label}>03 · 학생의 최종 선택</Text>
                <View style={styles.chips}>
                  {field.selectedKeywords.map((keyword) => (
                    <Text key={keyword} style={styles.chip}>
                      {keyword}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          ))}

          <View style={styles.blueCard} wrap={false}>
            <Text style={styles.rank}>스토리텔링</Text>
            <Text style={styles.cardTitle}>
              {report.majorStory.differentiator}
            </Text>
            <Text
              style={[
                styles.body,
                {
                  borderTopColor: '#dbeafe',
                  borderTopWidth: 1,
                  marginTop: 8,
                  paddingTop: 8,
                },
              ]}
            >
              {report.majorStory.explanation}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader
            number="02"
            eyebrow="CORE VALUE"
            title="전공 가치관"
            icon="target"
          />
          <Text style={styles.note}>내가 선택한 멘토의 조언</Text>
          <View style={[styles.gridRow, { marginTop: 7 }]}>
            {report.coreValue.mentorAdvice.map((mentor) => (
              <View
                key={`${mentor.name}-${mentor.affiliation}`}
                style={[styles.card, styles.halfCard]}
                wrap={false}
              >
                <MentorIdentity
                  name={mentor.name}
                  affiliation={mentor.affiliation}
                  muted
                />
                <Text style={styles.mentorAdvice}>“{mentor.advice}”</Text>
              </View>
            ))}
          </View>

          <Text style={[styles.rank, { marginBottom: 6, marginTop: 9 }]}>
            나만의 전공 가치관
          </Text>
          <View style={styles.blueCard} wrap={false}>
            <Text style={styles.valueStatement}>
              “{report.coreValue.statement}”
            </Text>
          </View>

          <View style={styles.gridRow}>
            {report.coreValue.guidingQuestions.map(([question, answer]) => (
              <View
                key={question}
                style={[styles.card, styles.halfCard]}
                wrap={false}
              >
                <Text style={styles.label}>{question}</Text>
                <Text style={[styles.cardTitle, { marginTop: 3 }]}>
                  {answer}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section} break>
          <SectionHeader
            number="03"
            eyebrow="COMPETENCY"
            title="계열 적합 역량"
            icon="brain"
          />
          {report.competencyMentorAdvice.map((mentor) => (
            <View
              key={`${mentor.name}-${mentor.affiliation}`}
              style={styles.card}
              wrap={false}
            >
              <MentorIdentity
                name={mentor.name}
                affiliation={mentor.affiliation}
              />
              <Text style={styles.label}>좋게 평가받았다고 생각하는 역량</Text>
              <Text style={styles.cardTitle}>{mentor.strength}</Text>
              <View
                style={{
                  borderTopColor: '#f1f5f9',
                  borderTopWidth: 1,
                  marginTop: 8,
                  paddingTop: 7,
                }}
              >
                <Text style={styles.note}>과목</Text>
                <Text style={styles.body}>{mentor.course}</Text>
                <Text style={[styles.note, { marginTop: 6 }]}>방법</Text>
                <Text style={styles.body}>{mentor.method}</Text>
              </View>
              <View style={styles.evidence}>
                <Text style={styles.body}>“{mentor.reflection}”</Text>
              </View>
            </View>
          ))}

          <Text style={[styles.rank, { marginBottom: 7, marginTop: 8 }]}>
            나만의 역량
          </Text>
          <View style={styles.gridRow}>
            {report.competencies.map((competency, index) => (
              <View
                key={competency.type}
                style={[styles.card, styles.thirdCard]}
                wrap={false}
              >
                <Text style={styles.rank}>
                  0{index + 1} · {competency.type}
                </Text>
                <Text style={[styles.cardTitle, { marginTop: 7 }]}>
                  {competency.title}
                </Text>
                <Text style={[styles.body, { marginTop: 6 }]}>
                  {competency.content}
                </Text>
                <View style={styles.evidence}>
                  <Text style={styles.note}>EVIDENCE</Text>
                  <Text style={[styles.body, { marginTop: 3 }]}>
                    {competency.evidence}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.oneLineBrand} wrap={false}>
          <Text style={styles.oneLineLabel}>BRANDING · ONE-LINE BRAND</Text>
          <Text style={styles.oneLineText}>{report.oneLineBrand}</Text>
        </View>

        <View style={styles.section} break>
          <SectionHeader
            number="01"
            eyebrow="SCHOOL RECORD STRATEGY"
            title="생기부 전반 전략"
            icon="route"
          />
          {report.schoolRecordStrategy.map((strategy, index) => (
            <View key={strategy.title} style={styles.card} wrap={false}>
              <View style={styles.strategyRow}>
                <Text style={[styles.rank, styles.strategyNumber]}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <View style={styles.strategyTitle}>
                  <Text style={styles.cardTitle}>{strategy.title}</Text>
                  <Text style={styles.strategyBasis}>
                    {strategy.basis.join(' · ')}
                  </Text>
                </View>
                <Text style={[styles.body, styles.strategyDescription]}>
                  {strategy.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <SectionHeader
            number="02"
            eyebrow="SUPPORTING VALUES"
            title="브랜드를 구체화하는 보조 가치"
            icon="sparkles"
          />
          <View style={styles.gridRow}>
            {report.supportingValues.map((value) => (
              <View
                key={value.value}
                style={[
                  styles.card,
                  styles.thirdCard,
                  value.role === '선택'
                    ? {
                        backgroundColor: colors.bluePale,
                        borderColor: '#bfdbfe',
                      }
                    : {},
                ]}
                wrap={false}
              >
                <Text style={styles.rank}>{value.role}</Text>
                <Text style={styles.cardTitle}>{value.value}</Text>
                <Text style={[styles.body, { marginTop: 5 }]}>
                  {value.description}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section} break>
          <SectionHeader
            number="03"
            eyebrow="PROJECT"
            title="브랜드 기반 장기 탐구 주제"
            icon="compass"
          />
          <View style={styles.roadmapGoal} wrap={false}>
            <Text style={styles.roadmapGoalLabel}>최종 탐구 목표</Text>
            <Text style={styles.roadmapGoalText}>
              {report.projectRoadmap.finalGoal}
            </Text>
            <Text
              style={[
                styles.note,
                {
                  borderTopColor: '#334155',
                  borderTopWidth: 1,
                  color: '#bfdbfe',
                  marginTop: 9,
                  paddingTop: 8,
                },
              ]}
            >
              {report.projectRoadmap.basis.join(' · ')}
            </Text>
          </View>
          {report.projectRoadmap.steps.map((step, index) => (
            <View key={step.number}>
              <View
                style={[
                  styles.roadmapCard,
                  step.stage === '최종 탐구' ? styles.roadmapCardFinal : {},
                ]}
                wrap={false}
              >
                <View style={styles.roadmapTop}>
                  <View
                    style={[
                      styles.roadmapNumber,
                      step.stage === '최종 탐구'
                        ? styles.roadmapNumberFinal
                        : {},
                    ]}
                  >
                    <Text style={styles.majorRankNumber}>{step.number}</Text>
                  </View>
                  <View style={styles.roadmapContent}>
                    <Text style={styles.rank}>{step.stage}</Text>
                    <Text style={styles.cardTitle}>{step.title}</Text>
                    <Text style={[styles.body, { marginTop: 6 }]}>
                      {step.question}
                    </Text>
                  </View>
                </View>
                <View style={styles.deliverable}>
                  <Text style={styles.note}>이 탐구에서 확보할 것</Text>
                  <Text style={[styles.body, { marginTop: 3 }]}>
                    {step.deliverable}
                  </Text>
                </View>
              </View>
              {index < report.projectRoadmap.steps.length - 1 ? (
                <Text style={styles.arrowRow}>이 탐구를 위하여</Text>
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.section} break>
          <SectionHeader
            number="04"
            eyebrow="COURSE STRATEGY"
            title="브랜드 기반 선택과목 후보"
            icon="book"
          />
          <View style={styles.gridRow}>
            {report.courses.map((course) => (
              <View
                key={course.course}
                style={[styles.card, styles.halfCard]}
                wrap={false}
              >
                <Text style={styles.cardTitle}>{course.course}</Text>
                <Text style={[styles.body, { marginTop: 4 }]}>
                  {course.reason}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.note}>
            실제 개설 과목과 선택 가능 여부는 학교 교육과정 편성표를 기준으로
            확인합니다. 본 문서는 가상 학생 사례를 바탕으로 구성한 예시
            리포트입니다.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadMaterialBoxReportPdf(
  reportType: MaterialBoxReportType,
) {
  const report = reports[reportType];
  const blob = await pdf(
    <MaterialBoxReportDocument report={report} />,
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = `${report.persona.name}_생활기록부_브랜딩_재료함_설계.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
