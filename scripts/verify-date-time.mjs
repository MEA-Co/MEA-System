import assert from 'node:assert/strict';
import test from 'node:test';
import { formatKoreanDate, formatKoreanDateTime } from '../lib/date-time.ts';

test('UTC and Korean offsets display the same Korean calendar day', () => {
  const utc = '2026-10-29T15:30:00.000Z';
  const korean = '2026-10-30T00:30:00+09:00';
  assert.equal(formatKoreanDate(utc), '2026. 10. 30.');
  assert.equal(formatKoreanDate(utc), formatKoreanDate(korean));
  assert.equal(formatKoreanDateTime(utc), formatKoreanDateTime(korean));
  assert.equal(formatKoreanDate('2026-10-29T14:59:59Z'), '2026. 10. 29.');
});
test('invalid timestamps display a placeholder', () => {
  assert.equal(formatKoreanDate('invalid'), '—');
  assert.equal(formatKoreanDateTime('invalid'), '—');
});
