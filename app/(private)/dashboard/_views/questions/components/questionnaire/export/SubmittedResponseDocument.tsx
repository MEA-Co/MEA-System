import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import type { ReactNode } from 'react';

import { parseRichText, type RichTextNode } from '../../../lib/rich-text';
import {
  submissionDate,
  type SubmittedResponse,
  submittedResponseSections,
} from '../../../lib/submitted-response-export';

const serverProcess = (
  globalThis as typeof globalThis & { process?: { cwd?: () => string } }
).process;
const fontBase = serverProcess?.cwd
  ? `${serverProcess.cwd()}/public/fonts`
  : '/fonts';
Font.register({
  family: 'SubmissionPretendard',
  fonts: [
    { src: `${fontBase}/Pretendard-Regular.otf`, fontWeight: 400 },
    { src: `${fontBase}/Pretendard-Bold.otf`, fontWeight: 700 },
  ],
});
const styles = StyleSheet.create({
  page: {
    fontFamily: 'SubmissionPretendard',
    fontSize: 10,
    paddingTop: 38,
    paddingHorizontal: 42,
    paddingBottom: 52,
    color: '#171717',
    backgroundColor: '#ffffff',
  },
  title: { fontSize: 21, fontWeight: 700, marginBottom: 8 },
  meta: { color: '#666666', fontSize: 9, marginBottom: 18 },
  section: {
    fontSize: 15,
    fontWeight: 700,
    marginTop: 18,
    marginBottom: 10,
    color: '#171717',
  },
  questionCard: { marginBottom: 18 },
  prompt: {
    borderTopWidth: 2,
    borderTopColor: '#ffe32b',
    paddingTop: 8,
    marginBottom: 8,
    fontSize: 11,
    fontWeight: 700,
  },
  answerCard: { marginBottom: 12 },
  answerHeading: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#d4d4d4',
    paddingBottom: 5,
    marginBottom: 7,
    fontWeight: 700,
  },
  fieldRow: { marginBottom: 8 },
  label: { fontSize: 9, fontWeight: 700, color: '#525252', marginBottom: 3 },
  value: { fontSize: 10, lineHeight: 1.35 },
  recommendation: { color: '#525252', fontSize: 8, marginBottom: 8 },
  paragraph: { marginBottom: 6 },
  footer: {
    position: 'absolute',
    top: 807,
    left: 42,
    right: 42,
    fontSize: 8,
    color: '#737373',
    textAlign: 'right',
  },
});

function richNodes(node: RichTextNode, key = 'root', prefix = ''): ReactNode {
  if (node.type === 'text')
    return (
      <Text
        key={key}
        style={
          node.marks?.some((mark) => mark.type === 'highlight')
            ? { backgroundColor: '#fef08a' }
            : undefined
        }
      >
        {node.text}
      </Text>
    );
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'paragraph')
    return (
      <Text key={key} style={styles.paragraph}>
        {prefix}
        {node.content?.map((child, index) =>
          richNodes(child, `${key}-${index}`),
        )}
      </Text>
    );
  if (node.type === 'bulletList' || node.type === 'orderedList')
    return (
      <View key={key} style={{ paddingLeft: 10 }}>
        {node.content?.map((child, index) =>
          richNodes(
            child,
            `${key}-${index}`,
            node.type === 'orderedList'
              ? `${(node.attrs?.start ?? 1) + index}. `
              : node.attrs?.marker === 'plus'
                ? '+ '
                : '• ',
          ),
        )}
      </View>
    );
  return (
    <View key={key}>
      {node.content?.map((child, index) =>
        richNodes(child, `${key}-${index}`, index === 0 ? prefix : ''),
      )}
    </View>
  );
}
function RichText({ value }: { value: string }) {
  const doc = parseRichText(value);
  return doc ? richNodes(doc) : <Text style={styles.paragraph}>{value}</Text>;
}

export function SubmittedResponseDocument({
  submission,
}: {
  submission: SubmittedResponse;
}) {
  const sections = submittedResponseSections(submission);
  return (
    <Document
      title={`${submission.respondentName || '이름 없음'} · ${submission.title}`}
      language="ko-KR"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{submission.title}</Text>
        <Text style={styles.meta}>
          {submission.respondentName || '이름 없음'} ·{' '}
          {submissionDate(submission.submittedAt)} 최종 제출 (한국 시간)
        </Text>
        {sections.map((section, sectionIndex) => (
          <View key={section.id}>
            <Text style={styles.section} minPresenceAhead={60}>
              {sectionIndex + 1}. {section.title || '질문'}
            </Text>
            {section.questions.map((question, questionIndex) => (
              <View key={question.id} style={styles.questionCard}>
                <View style={styles.prompt} minPresenceAhead={60}>
                  <Text style={{ color: '#737373', marginBottom: 4 }}>
                    {questionIndex + 1}
                  </Text>
                  <RichText value={question.prompt} />
                </View>
                {question.recommendations.map((label) => (
                  <Text key={label} style={styles.recommendation}>
                    {label}
                  </Text>
                ))}
                {question.rows.length ? (
                  question.rows.map((row) => (
                    <View key={row.id} style={styles.answerCard}>
                      {row.label ? (
                        <Text
                          style={styles.answerHeading}
                          minPresenceAhead={48}
                        >
                          {row.label}
                        </Text>
                      ) : null}
                      {row.fields.map((field) => (
                        <View key={field.id} style={styles.fieldRow}>
                          <Text style={styles.label} minPresenceAhead={22}>
                            {field.label}
                          </Text>
                          <View style={styles.value}>
                            <RichText value={field.value} />
                          </View>
                        </View>
                      ))}
                    </View>
                  ))
                ) : (
                  <Text style={styles.meta}>제출된 활성 답변 없음</Text>
                )}
              </View>
            ))}
          </View>
        ))}
        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
