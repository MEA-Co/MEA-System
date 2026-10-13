import { pdf } from '@react-pdf/renderer';
import { zipSync } from 'fflate';

import {
  exportFileName,
  submissionFileName,
  type SubmittedResponse,
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
  submissions: SubmittedResponse[],
  archive: boolean,
  progress: (done: number, total: number) => void,
) {
  if (!submissions.length) throw new Error('다운로드할 제출 응답이 없어요.');
  const files: Record<string, Uint8Array> = {};
  for (const [index, submission] of submissions.entries()) {
    progress(index, submissions.length);
    const blob = await pdf(
      <SubmittedResponseDocument submission={submission} />,
    ).toBlob();
    const name = submissionFileName(submission, index);
    if (archive) files[name] = new Uint8Array(await blob.arrayBuffer());
    else saveBlob(blob, name);
    progress(index + 1, submissions.length);
    // Let the progress indicator paint between documents.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (archive) {
    const bytes = zipSync(files, { level: 0 });
    saveBlob(
      new Blob([new Uint8Array(bytes)], { type: 'application/zip' }),
      `${exportFileName(submissions[0].title)}_사람별_제출응답.zip`,
    );
  }
}
