import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  announcementInput,
  isAnnouncementActive,
} from '../lib/announcements/schema.ts';

const base = {
  id: 1,
  title: '점검 안내',
  body: '저장해 주세요.',
  enabled: true,
  starts_at: null,
  ends_at: null,
  revision: 0,
  updated_at: '2026-10-16T00:00:00Z',
};

test('scheduled notice starts inclusively and ends exclusively', () => {
  const scheduled = {
    ...base,
    starts_at: '2026-10-16T02:00:00Z',
    ends_at: '2026-10-16T03:00:00Z',
  };
  assert.equal(
    isAnnouncementActive(scheduled, Date.parse('2026-10-16T01:59:59Z')),
    false,
  );
  assert.equal(
    isAnnouncementActive(scheduled, Date.parse(scheduled.starts_at)),
    true,
  );
  assert.equal(
    isAnnouncementActive(scheduled, Date.parse(scheduled.ends_at)),
    false,
  );
  assert.equal(
    isAnnouncementActive(
      { ...scheduled, enabled: false },
      Date.parse(scheduled.starts_at),
    ),
    false,
  );
  assert.equal(isAnnouncementActive(base, Date.parse(base.updated_at)), true);
});

test('reject empty active notice, reversed dates, forged fields and invalid revisions', () => {
  const { id, updated_at, ...input } = base;
  assert.equal(announcementInput.safeParse(input).success, true);
  for (const change of [
    { title: ' ' },
    { body: '' },
    { starts_at: 'invalid' },
    { revision: -1 },
    { updated_at },
    { starts_at: '2026-10-16T03:00:00Z', ends_at: '2026-10-16T02:00:00Z' },
  ]) {
    assert.equal(
      announcementInput.safeParse({ ...input, ...change }).success,
      false,
    );
  }
  assert.equal(
    announcementInput.safeParse({
      ...input,
      title: '',
      body: '',
      enabled: false,
    }).success,
    true,
  );
});
