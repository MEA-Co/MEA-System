import assert from 'node:assert/strict';
import test from 'node:test';

import { loadQuestionModule } from './helpers/load-question-module.mjs';
function downloader() {
  const events = [];
  const exports = loadQuestionModule(
    'app/(private)/dashboard/_views/questions/components/questionnaire/export/download-submissions.tsx',
    {
      Blob,
      Uint8Array,
      setTimeout: (fn) => {
        fn();
      },
      URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
      document: {
        body: { append() {} },
        createElement: () => ({
          click: () => events.push('download'),
          remove() {},
        }),
      },
    },
    (name) =>
      ({
        'react/jsx-runtime': { jsx: (_type, props) => props },
        '@react-pdf/renderer': {
          pdf: ({ submission }) => ({
            toBlob: async () => {
              events.push(`render:${submission.id}`);
              return new Blob(['pdf']);
            },
          }),
        },
        fflate: {
          zipSync: (files) => {
            events.push(`zip:${Object.keys(files).length}`);
            return new Uint8Array([1]);
          },
        },
        './SubmittedResponseDocument': {
          SubmittedResponseDocument: 'Document',
        },
        '../../../lib/submitted-response-export': {
          submissionFileName: (item, i) => `${i}_${item.id}.pdf`,
          exportFileName: (value) => value,
        },
      })[name],
  );
  return { download: exports.downloadSubmissions, events };
}
test('ZIP export loads and renders one submission at a time before the next detail request', async () => {
  const { download, events } = downloader();
  await download(
    {
      total: 3,
      load: async (index) => {
        events.push(`load:${index}`);
        return { id: String(index), title: '질문지' };
      },
    },
    true,
    () => {},
  );
  assert.deepEqual(events, [
    'load:0',
    'render:0',
    'load:1',
    'render:1',
    'load:2',
    'render:2',
    'zip:3',
    'download',
  ]);
});
test('a changed or unavailable submission aborts the archive rather than downloading partial results', async () => {
  const { download, events } = downloader();
  await assert.rejects(
    download(
      {
        total: 2,
        load: async (index) => {
          if (index) throw new Error('revision conflict');
          return { id: '0', title: '질문지' };
        },
      },
      true,
      () => {},
    ),
    /revision conflict/,
  );
  assert.equal(events.includes('download'), false);
});
