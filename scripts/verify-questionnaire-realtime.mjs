import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

import ts from 'typescript';

const base = 'app/(private)/dashboard/_views/questionnaire/';
function compile(file, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(base + file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require: (name) => {
        assert.ok(name in imports, name);
        return imports[name];
      },
      ...globals,
    },
  );
  return exports;
}
function setup(audience = 'staff') {
  const channels = [];
  const removed = [];
  const timers = new Map();
  const listeners = new Map();
  let refreshes = 0;
  let unsubscribeCount = 0;
  let cleanup;
  let authChanged;
  let nextTimer = 0;
  const events = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const document = { hidden: false, ...events };
  const navigator = { onLine: true };
  const client = {
    channel(topic, config) {
      const channel = {
        topic,
        config,
        on(kind, options, fn) {
          assert.equal(kind, 'broadcast');
          assert.equal(options.event, 'changed');
          this.event = fn;
          return this;
        },
        subscribe(fn) {
          this.status = fn;
          return this;
        },
      };
      channels.push(channel);
      return channel;
    },
    removeChannel: (channel) => {
      removed.push(channel);
      return Promise.resolve();
    },
    auth: {
      onAuthStateChange(fn) {
        authChanged = fn;
        return {
          data: {
            subscription: {
              unsubscribe() {
                unsubscribeCount++;
              },
            },
          },
        };
      },
    },
  };
  const subject = compile(
    'hooks/useQuestionnaireRealtime.ts',
    {
      react: {
        useEffect: (fn) => {
          cleanup = fn();
        },
      },
      '@/lib/supabase/client': { createClient: () => client },
      '../lib/api-client': {
        useQuestionnaireApi: () => ({
          refresh: async () => {
            refreshes++;
          },
        }),
      },
    },
    {
      document,
      navigator,
      window: events,
      setTimeout: (fn, delay) => {
        assert.equal(delay, 250);
        const id = ++nextTimer;
        timers.set(id, fn);
        return id;
      },
      clearTimeout: (id) => timers.delete(id),
    },
  );
  subject.useQuestionnaireRealtime(audience, 'user-id');
  return {
    channels,
    removed,
    document,
    navigator,
    listeners,
    timers,
    cleanup: () => cleanup?.(),
    authChanged: (...args) => authChanged(...args),
    flush() {
      const tasks = [...timers.values()];
      timers.clear();
      for (const fn of tasks) fn();
    },
    get refreshes() {
      return refreshes;
    },
    get unsubscribeCount() {
      return unsubscribeCount;
    },
  };
}

test('staff uses private role and own receipt channels; notification bursts coalesce', () => {
  const s = setup();
  assert.deepEqual(
    s.channels.map((c) => c.topic),
    ['questionnaires:staff', 'questionnaires:user:user-id'],
  );
  for (const c of s.channels) assert.equal(c.config.config.private, true);
  s.channels[0].event();
  s.channels[1].event();
  s.channels[0].event();
  assert.equal(s.timers.size, 1);
  s.flush();
  assert.equal(s.refreshes, 1);
  s.channels[0].status('SUBSCRIBED');
  s.flush();
  assert.equal(s.refreshes, 2);
  s.channels[0].status('CHANNEL_ERROR');
  s.flush();
  assert.equal(s.refreshes, 2);
  s.channels[0].status('SUBSCRIBED');
  s.flush();
  assert.equal(s.refreshes, 3);
  s.cleanup();
});

test('consultants subscribe only to distributed changes; students do not connect', () => {
  const consultant = setup('distributed');
  assert.deepEqual(
    consultant.channels.map((c) => c.topic),
    ['questionnaires:distributed'],
  );
  consultant.cleanup();
  const student = setup(null);
  assert.equal(student.channels.length, 0);
  assert.equal(student.listeners.size, 0);
});

test('hidden and offline clients defer changes and catch up on resume', () => {
  const s = setup();
  s.document.hidden = true;
  s.channels[0].event();
  s.flush();
  assert.equal(s.refreshes, 0);
  s.document.hidden = false;
  s.listeners.get('visibilitychange')();
  s.flush();
  assert.equal(s.refreshes, 1);
  s.navigator.onLine = false;
  s.channels[0].event();
  s.flush();
  assert.equal(s.refreshes, 1);
  s.navigator.onLine = true;
  s.listeners.get('online')();
  s.flush();
  assert.equal(s.refreshes, 2);
  s.cleanup();
});

test('unmount, sign-out and account switch stop pending and late callbacks', () => {
  for (const stop of [
    (s) => s.cleanup(),
    (s) => s.authChanged('SIGNED_OUT', null),
    (s) => s.authChanged('SIGNED_IN', { user: { id: 'other-user' } }),
  ]) {
    const s = setup();
    s.channels[0].event();
    stop(s);
    s.channels[0].event();
    s.channels[0].status('SUBSCRIBED');
    s.flush();
    assert.equal(s.refreshes, 0);
    assert.ok(s.removed.includes(s.channels[0]));
    s.cleanup();
    assert.equal(s.listeners.size, 0);
    assert.ok(s.unsubscribeCount > 0);
  }
  const s = setup();
  s.authChanged('TOKEN_REFRESHED', { user: { id: 'user-id' } });
  s.channels[0].event();
  s.flush();
  assert.equal(s.refreshes, 1);
  s.cleanup();
});

test('SWR retains focus/reconnect recovery and uses 60-second fallback, never polling new forms', () => {
  const configurations = [];
  const subject = compile('lib/api-client.ts', {
    react: { useCallback: (fn) => fn },
    swr: {
      default: (key, _fetcher, config) => configurations.push({ key, config }),
      useSWRConfig: () => ({}),
    },
  });
  subject.useQuestionnaireResource('/version');
  subject.useQuestionnaireResource('/unread');
  subject.useQuestionnaireResource('/new?instance=one');
  for (const { config } of configurations.slice(0, 2)) {
    assert.equal(config.refreshInterval, 60_000);
    assert.equal(config.revalidateOnFocus, true);
    assert.equal(config.revalidateOnReconnect, true);
  }
  assert.equal(configurations[2].config.refreshInterval, 0);
  assert.equal(configurations[2].config.revalidateOnFocus, false);
});
