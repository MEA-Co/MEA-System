import path from 'node:path';

import type { DocumentProps } from '@react-pdf/renderer';
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { ReactElement } from 'react';

import type { MaterialBoxReportData } from '@/app/(private)/consulting/material-box/_report/types';

import {
  createMaterialBoxReport,
  formatMaterialBoxReportDate,
} from './content';

Font.register({
  family: 'Pretendard',
  fonts: [
    {
      src: path.join(process.cwd(), 'public/fonts/Pretendard-Regular.otf'),
      fontWeight: 400,
    },
    {
      src: path.join(process.cwd(), 'public/fonts/Pretendard-SemiBold.otf'),
      fontWeight: 600,
    },
    {
      src: path.join(process.cwd(), 'public/fonts/Pretendard-Bold.otf'),
      fontWeight: 700,
    },
  ],
});

const colors = {
  ink: '#16213C',
  navy: '#172554',
  blue: '#2563EB',
  blueSoft: '#EFF6FF',
  slate: '#64748B',
  border: '#DCE5F0',
  paper: '#FFFFFF',
  background: '#F7F9FC',
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 54,
    paddingRight: 46,
    paddingBottom: 52,
    paddingLeft: 46,
    backgroundColor: colors.paper,
    color: colors.ink,
    fontFamily: 'Pretendard',
    fontSize: 10,
    lineHeight: 1.55,
  },
  header: {
    position: 'absolute',
    top: 25,
    right: 46,
    left: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.8,
  },
  headerLabel: {
    color: colors.slate,
    fontSize: 7.5,
    letterSpacing: 1.2,
  },
  footer: {
    position: 'absolute',
    right: 46,
    bottom: 24,
    left: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 0.7,
    borderTopColor: colors.border,
    paddingTop: 8,
    color: colors.slate,
    fontSize: 7,
  },
  hero: {
    borderRadius: 10,
    backgroundColor: colors.navy,
    paddingTop: 28,
    paddingRight: 30,
    paddingBottom: 28,
    paddingLeft: 30,
    color: '#FFFFFF',
  },
  heroEyebrow: {
    color: '#93C5FD',
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 1.4,
  },
  heroTitle: {
    marginTop: 13,
    maxWidth: 440,
    fontSize: 24,
    fontWeight: 700,
    lineHeight: 1.3,
  },
  heroDescription: {
    marginTop: 12,
    color: '#CBD5E1',
    fontSize: 9,
  },
  heroMeta: {
    marginTop: 23,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.6,
    borderTopColor: '#33466E',
    paddingTop: 12,
  },
  heroMetaLabel: {
    color: '#93A4C2',
    fontSize: 7,
  },
  heroMetaValue: {
    marginTop: 3,
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 600,
  },
  sectionHeading: {
    marginTop: 25,
    marginBottom: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeadingTitle: {
    color: colors.navy,
    fontSize: 14,
    fontWeight: 700,
  },
  sectionHeadingCaption: {
    color: colors.slate,
    fontSize: 7.5,
  },
  overview: {
    flexDirection: 'row',
    gap: 9,
  },
  overviewCard: {
    flexGrow: 1,
    flexBasis: 0,
    borderWidth: 0.8,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
    padding: 13,
  },
  overviewLabel: {
    color: colors.blue,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.8,
  },
  overviewValue: {
    marginTop: 7,
    color: colors.ink,
    fontSize: 10.5,
    fontWeight: 600,
    lineHeight: 1.45,
  },
  majorList: {
    marginTop: 6,
    gap: 3,
  },
  majorItem: {
    color: colors.ink,
    fontSize: 9,
  },
  reportCard: {
    marginBottom: 11,
    borderWidth: 0.8,
    borderColor: colors.border,
    borderRadius: 9,
    paddingTop: 15,
    paddingRight: 17,
    paddingBottom: 16,
    paddingLeft: 17,
  },
  reportCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  reportNumber: {
    width: 29,
    color: colors.blue,
    fontSize: 9,
    fontWeight: 700,
  },
  reportTitleGroup: {
    flexGrow: 1,
  },
  reportEyebrow: {
    color: colors.slate,
    fontSize: 6.8,
    fontWeight: 700,
    letterSpacing: 0.8,
  },
  reportTitle: {
    marginTop: 3,
    color: colors.navy,
    fontSize: 11,
    fontWeight: 700,
  },
  reportContent: {
    marginTop: 11,
    marginLeft: 29,
    color: '#334155',
    fontSize: 9.5,
    lineHeight: 1.65,
  },
  summary: {
    marginTop: 2,
    borderRadius: 10,
    backgroundColor: colors.blueSoft,
    paddingTop: 20,
    paddingRight: 22,
    paddingBottom: 20,
    paddingLeft: 22,
  },
  summaryLabel: {
    color: colors.blue,
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 1,
  },
  summaryTitle: {
    marginTop: 6,
    color: colors.navy,
    fontSize: 14,
    fontWeight: 700,
  },
  summaryText: {
    marginTop: 11,
    color: '#334155',
    fontSize: 9.5,
    lineHeight: 1.7,
  },
  nextSteps: {
    gap: 8,
  },
  nextStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 0.8,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 13,
  },
  nextStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.navy,
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: 700,
    textAlign: 'center',
    paddingTop: 5,
  },
  nextStepBody: {
    flexGrow: 1,
    marginLeft: 11,
  },
  nextStepTitle: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: 700,
  },
  nextStepDescription: {
    marginTop: 4,
    color: colors.slate,
    fontSize: 8.5,
    lineHeight: 1.55,
  },
});

function ReportHeader() {
  return (
    <View style={styles.header} fixed>
      <Text style={styles.brand}>MEA</Text>
      <Text style={styles.headerLabel}>MATERIAL BOX CONSULTING REPORT</Text>
    </View>
  );
}

function ReportFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text>생활기록부 브랜딩 컨설팅 · 재료함 설계</Text>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

type MaterialBoxReportDocumentProps = {
  data: MaterialBoxReportData;
  issuedAt: Date;
};

export function createMaterialBoxReportDocument({
  data,
  issuedAt,
}: MaterialBoxReportDocumentProps): ReactElement<DocumentProps> {
  const report = createMaterialBoxReport(data);
  const issuedDate = formatMaterialBoxReportDate(issuedAt);

  return (
    <Document
      title="MEA 재료함 컨설팅 리포트"
      author="MEA"
      subject="생활기록부 브랜딩 컨설팅 결과"
      language="ko-KR"
      creator="MEA Consulting"
    >
      <Page size="A4" style={styles.page} wrap>
        <ReportHeader />

        <View style={styles.hero} wrap={false}>
          <Text style={styles.heroEyebrow}>FINAL CONSULTING REPORT</Text>
          <Text style={styles.heroTitle}>{report.careerIdentity}</Text>
          <Text style={styles.heroDescription}>
            관심 분야에서 출발해 완성한 나만의 진로 브랜드 방향
          </Text>
          <View style={styles.heroMeta}>
            <View>
              <Text style={styles.heroMetaLabel}>핵심 세부 키워드</Text>
              <Text style={styles.heroMetaValue}>{report.keyword}</Text>
            </View>
            <View>
              <Text style={styles.heroMetaLabel}>리포트 발행일</Text>
              <Text style={styles.heroMetaValue}>{issuedDate}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeading} wrap={false}>
          <Text style={styles.sectionHeadingTitle}>
            진로 브랜드 한눈에 보기
          </Text>
          <Text style={styles.sectionHeadingCaption}>BRAND SNAPSHOT</Text>
        </View>
        <View style={styles.overview} wrap={false}>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewLabel}>희망 전공</Text>
            <View style={styles.majorList}>
              {report.majors.map((major, index) => (
                <Text key={`${major}-${index}`} style={styles.majorItem}>
                  {index + 1}. {major}
                </Text>
              ))}
            </View>
          </View>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewLabel}>세부 키워드</Text>
            <Text style={styles.overviewValue}>{report.keyword}</Text>
          </View>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewLabel}>진로 명칭</Text>
            <Text style={styles.overviewValue}>{report.careerIdentity}</Text>
          </View>
        </View>

        <View style={styles.sectionHeading} wrap={false}>
          <Text style={styles.sectionHeadingTitle}>나의 진로 방향</Text>
          <Text style={styles.sectionHeadingCaption}>DIRECTION & VALUE</Text>
        </View>
        {report.sections.slice(0, 2).map((section) => (
          <View key={section.number} style={styles.reportCard} wrap={false}>
            <View style={styles.reportCardHeader}>
              <Text style={styles.reportNumber}>{section.number}</Text>
              <View style={styles.reportTitleGroup}>
                <Text style={styles.reportEyebrow}>{section.eyebrow}</Text>
                <Text style={styles.reportTitle}>{section.title}</Text>
              </View>
            </View>
            <Text style={styles.reportContent}>{section.content}</Text>
          </View>
        ))}

        <ReportFooter />
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <ReportHeader />

        <View style={styles.sectionHeading} wrap={false}>
          <Text style={styles.sectionHeadingTitle}>나를 움직이는 강점</Text>
          <Text style={styles.sectionHeadingCaption}>STRENGTH & POTENTIAL</Text>
        </View>
        {report.sections.slice(2).map((section) => (
          <View key={section.number} style={styles.reportCard} wrap={false}>
            <View style={styles.reportCardHeader}>
              <Text style={styles.reportNumber}>{section.number}</Text>
              <View style={styles.reportTitleGroup}>
                <Text style={styles.reportEyebrow}>{section.eyebrow}</Text>
                <Text style={styles.reportTitle}>{section.title}</Text>
              </View>
            </View>
            <Text style={styles.reportContent}>{section.content}</Text>
          </View>
        ))}

        <View style={styles.summary} wrap={false}>
          <Text style={styles.summaryLabel}>CONSULTANT SUMMARY</Text>
          <Text style={styles.summaryTitle}>컨설턴트 종합 의견</Text>
          <Text style={styles.summaryText}>{report.consultantSummary}</Text>
        </View>

        <View style={styles.sectionHeading} wrap={false}>
          <Text style={styles.sectionHeadingTitle}>다음 활동 설계 가이드</Text>
          <Text style={styles.sectionHeadingCaption}>NEXT ACTIONS</Text>
        </View>
        <View style={styles.nextSteps}>
          {report.nextSteps.map((step) => (
            <View key={step.number} style={styles.nextStep} wrap={false}>
              <Text style={styles.nextStepNumber}>{step.number}</Text>
              <View style={styles.nextStepBody}>
                <Text style={styles.nextStepTitle}>{step.title}</Text>
                <Text style={styles.nextStepDescription}>
                  {step.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <ReportFooter />
      </Page>
    </Document>
  );
}
