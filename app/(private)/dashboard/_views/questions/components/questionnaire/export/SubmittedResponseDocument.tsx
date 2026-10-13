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
    color: '#172033',
  },
  title: { fontSize: 21, fontWeight: 700, marginBottom: 8 },
  meta: { color: '#536176', fontSize: 9, marginBottom: 18 },
  section: {
    fontSize: 15,
    fontWeight: 700,
    marginTop: 18,
    marginBottom: 10,
    color: '#244c72',
  },
  question: { fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 5 },
  row: {
    fontSize: 10,
    fontWeight: 700,
    marginTop: 10,
    marginBottom: 5,
    color: '#244c72',
  },
  field: {
    fontSize: 9,
    fontWeight: 700,
    color: '#536176',
    marginTop: 7,
    marginBottom: 3,
  },
  paragraph: { marginBottom: 6 },
  footer: {
    position: 'absolute',
    top: 807,
    left: 42,
    right: 42,
    fontSize: 8,
    color: '#64748b',
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
          {submissionDate(submission.submittedAt)} 제출 (한국 시간){'\n'}마지막
          제출 내용
        </Text>
        {sections.map((section, sectionIndex) => (
          <View key={section.id}>
            <Text style={styles.section} minPresenceAhead={60}>
              {sectionIndex + 1}. {section.title || '질문'}
            </Text>
            {section.questions.map((question, questionIndex) => (
              <View key={question.id}>
                <Text style={styles.question} minPresenceAhead={40}>
                  {questionIndex + 1}. {question.title || '질문'}
                </Text>
                <RichText value={question.prompt} />
                {question.rows.length ? (
                  question.rows.map((row) => (
                    <View key={row.id}>
                      {row.label ? (
                        <Text style={styles.row} minPresenceAhead={40}>
                          {row.label}
                        </Text>
                      ) : null}
                      {row.fields.map((field) => (
                        <View key={field.id}>
                          <Text style={styles.field} minPresenceAhead={22}>
                            {field.label}
                          </Text>
                          <RichText value={field.value} />
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
