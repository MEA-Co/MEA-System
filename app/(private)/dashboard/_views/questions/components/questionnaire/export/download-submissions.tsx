import { pdf } from '@react-pdf/renderer';
import { zipSync } from 'fflate';

import type { SubmissionDownload } from '../../../lib/responses/submissions';
import {
  exportFileName,
  submissionFileName,
} from '../../../lib/submitted-response-export';

import { SubmittedResponseDocument } from './SubmittedResponseDocument';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadSubmissions(
  submissions: SubmissionDownload,
  archive: boolean,
  progress: (done: number, total: number) => void,
) {
  if (!submissions.total) throw new Error('다운로드할 제출 응답이 없어요.');
  const files: Record<string, Uint8Array> = {};
  let title = '';
  for (let index = 0; index < submissions.total; index++) {
    const submission = await submissions.load(index);
    title ||= submission.title;
    progress(index, submissions.total);
    const blob = await pdf(
      <SubmittedResponseDocument submission={submission} />,
    ).toBlob();
    const name = submissionFileName(submission, index);
    if (archive) files[name] = new Uint8Array(await blob.arrayBuffer());
    else saveBlob(blob, name);
    progress(index + 1, submissions.total);
    // Let the progress indicator paint between documents.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (archive) {
    const bytes = zipSync(files, { level: 0 });
    saveBlob(
      new Blob([new Uint8Array(bytes)], { type: 'application/zip' }),
      `${exportFileName(title)}_사람별_제출응답.zip`,
    );
  }
}
