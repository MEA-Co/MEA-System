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

import type { ConsultingReportDocument } from '@/features/consulting/report/protocol';

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
    gap: 22,
    borderTopWidth: 0.6,
    borderTopColor: '#33466E',
    paddingTop: 12,
  },
  heroMetaItem: {
    flexGrow: 1,
    flexBasis: 0,
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
    fontSize: 9.5,
    fontWeight: 600,
    lineHeight: 1.45,
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
  callout: {
    marginTop: 2,
    borderRadius: 10,
    backgroundColor: colors.blueSoft,
    paddingTop: 20,
    paddingRight: 22,
    paddingBottom: 20,
    paddingLeft: 22,
  },
  calloutLabel: {
    color: colors.blue,
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 1,
  },
  calloutTitle: {
    marginTop: 6,
    color: colors.navy,
    fontSize: 14,
    fontWeight: 700,
  },
  calloutText: {
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

export function createConsultingReportDocument(
  report: ConsultingReportDocument,
): ReactElement<DocumentProps> {
  return (
    <Document {...report.metadata}>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <Text style={styles.brand}>{report.header.brand}</Text>
          <Text style={styles.headerLabel}>{report.header.label}</Text>
        </View>

        <View style={styles.hero} wrap={false}>
          {report.hero.eyebrow ? (
            <Text style={styles.heroEyebrow}>{report.hero.eyebrow}</Text>
          ) : null}
          <Text style={styles.heroTitle}>{report.hero.title}</Text>
          {report.hero.description ? (
            <Text style={styles.heroDescription}>
              {report.hero.description}
            </Text>
          ) : null}
          {report.hero.meta?.length ? (
            <View style={styles.heroMeta}>
              {report.hero.meta.map((item, index) => (
                <View
                  key={`${item.label}-${index}`}
                  style={styles.heroMetaItem}
                >
                  <Text style={styles.heroMetaLabel}>{item.label}</Text>
                  <Text style={styles.heroMetaValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {report.overview ? (
          <>
            <View style={styles.sectionHeading} wrap={false}>
              <Text style={styles.sectionHeadingTitle}>
                {report.overview.title}
              </Text>
              {report.overview.caption ? (
                <Text style={styles.sectionHeadingCaption}>
                  {report.overview.caption}
                </Text>
              ) : null}
            </View>
            <View style={styles.overview} wrap={false}>
              {report.overview.cards.map((card, cardIndex) => (
                <View
                  key={`${card.label}-${cardIndex}`}
                  style={styles.overviewCard}
                >
                  <Text style={styles.overviewLabel}>{card.label}</Text>
                  {card.values.map((value, valueIndex) => (
                    <Text
                      key={`${value}-${valueIndex}`}
                      style={styles.overviewValue}
                    >
                      {value}
                    </Text>
                  ))}
                </View>
              ))}
            </View>
          </>
        ) : null}

        {report.sectionGroups.map((group, groupIndex) => (
          <View key={`${group.title}-${groupIndex}`}>
            <View style={styles.sectionHeading} wrap={false}>
              <Text style={styles.sectionHeadingTitle}>{group.title}</Text>
              {group.caption ? (
                <Text style={styles.sectionHeadingCaption}>
                  {group.caption}
                </Text>
              ) : null}
            </View>
            {group.sections.map((section, sectionIndex) => (
              <View
                key={`${section.title}-${sectionIndex}`}
                style={styles.reportCard}
                wrap={false}
              >
                <View style={styles.reportCardHeader}>
                  <Text style={styles.reportNumber}>
                    {section.number ?? ''}
                  </Text>
                  <View style={styles.reportTitleGroup}>
                    {section.eyebrow ? (
                      <Text style={styles.reportEyebrow}>
                        {section.eyebrow}
                      </Text>
                    ) : null}
                    <Text style={styles.reportTitle}>{section.title}</Text>
                  </View>
                </View>
                <Text style={styles.reportContent}>{section.content}</Text>
              </View>
            ))}
          </View>
        ))}

        {report.callout ? (
          <View style={styles.callout} wrap={false}>
            {report.callout.label ? (
              <Text style={styles.calloutLabel}>{report.callout.label}</Text>
            ) : null}
            <Text style={styles.calloutTitle}>{report.callout.title}</Text>
            <Text style={styles.calloutText}>{report.callout.content}</Text>
          </View>
        ) : null}

        {report.nextSteps ? (
          <>
            <View style={styles.sectionHeading} wrap={false}>
              <Text style={styles.sectionHeadingTitle}>
                {report.nextSteps.title}
              </Text>
              {report.nextSteps.caption ? (
                <Text style={styles.sectionHeadingCaption}>
                  {report.nextSteps.caption}
                </Text>
              ) : null}
            </View>
            <View style={styles.nextSteps}>
              {report.nextSteps.items.map((step, index) => (
                <View
                  key={`${step.title}-${index}`}
                  style={styles.nextStep}
                  wrap={false}
                >
                  <Text style={styles.nextStepNumber}>
                    {step.number ?? `${index + 1}`}
                  </Text>
                  <View style={styles.nextStepBody}>
                    <Text style={styles.nextStepTitle}>{step.title}</Text>
                    <Text style={styles.nextStepDescription}>
                      {step.description}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>{report.footer}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
