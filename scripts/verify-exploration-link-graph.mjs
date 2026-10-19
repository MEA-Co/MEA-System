import assert from 'node:assert/strict';
import test from 'node:test';

import { canConnectLink } from '../app/(private)/dashboard/_views/exploration/lib/link-graph.ts';

test('allows direct and indirect references to the same follow-up', () => {
  const edges = [{ from: '1', to: '2' }, { from: '1', to: '3' }];
  assert.equal(canConnectLink(edges, '2', '3'), true);
  assert.equal(canConnectLink(edges, '3', '2'), true);
});

test('rejects self references, duplicate edges and transitive cycles', () => {
  const edges = [{ from: '1', to: '2' }, { from: '2', to: '3' }, { from: '1', to: '3' }];
  assert.equal(canConnectLink(edges, '1', '1'), false);
  assert.equal(canConnectLink(edges, '1', '2'), false);
  assert.equal(canConnectLink(edges, '3', '1'), false);
  assert.equal(canConnectLink(edges, '3', '2'), false);
});

test('allows multiple predecessors and successors regardless of visual columns', () => {
  const edges = [{ from: 'a', to: 'c' }, { from: 'b', to: 'c' }];
  assert.equal(canConnectLink(edges, 'a', 'b'), true);
  assert.equal(canConnectLink(edges, 'c', 'd'), true);
  assert.equal(canConnectLink(edges, 'b', 'd'), true);
});
