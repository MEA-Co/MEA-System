import assert from 'node:assert/strict';
import test from 'node:test';
import { guardLinkHistory } from '../app/(private)/dashboard/_views/exploration/lib/link-history-guard.ts';

function browser() {
  let entries = [{ url: '/list', state: { page: 'list' } }, { url: '/edit', state: { __NA: true, tree: 'editor' } }];
  let index = 1, listener;
  const routed = [];
  const target = {
    location: { get href() { return entries[index].url; } },
    history: {
      get state() { return entries[index].state; },
      pushState(state, _, url) { entries = [...entries.slice(0, index + 1), {state, url}]; index++; },
      back() {
        if (index === 0) return;
        index--;
        let stopped = false;
        listener?.({stopImmediatePropagation() { stopped = true; }});
        if (!stopped) routed.push(entries[index].url);
      },
    },
    addEventListener(_, callback, capture) { assert.equal(capture, true); listener = callback; },
    removeEventListener(_, callback) { if (callback === listener) listener = undefined; },
  };
  return {target, routed};
}
test('back keeps editor state mounted until explicitly accepted, including repeated cancellation', () => {
  const {target, routed} = browser(); let proceed;
  const cleanup = guardLinkHistory(target, false, next => { proceed = next; });
  for (let i = 0; i < 3; i++) {
    target.history.back();
    assert.equal(target.location.href, '/edit');
    assert.equal(target.history.state.tree, 'editor');
    assert.deepEqual(routed, []);
  }
  proceed();
  assert.equal(target.location.href, '/list');
  assert.deepEqual(routed, ['/list']);
  cleanup();
});
test('saving blocks history exits; cleanup restores normal navigation without extra entries', () => {
  const {target, routed} = browser();
  const cleanup = guardLinkHistory(target, true, () => assert.fail('must not request exit during save'));
  target.history.back();
  assert.equal(target.location.href, '/edit');
  assert.deepEqual(routed, []);
  cleanup(); target.history.back();
  assert.deepEqual(routed, ['/list']);
});

function modernBrowser() {
  const entries = ['/list', '/edit', '/next', '/last'].map((path, index) => ({ key: String(index), url: `https://example.com${path}`, sameDocument: true }));
  let index = 1, listener;
  const target = {
    location: { get href() { return entries[index].url; } },
    navigation: {
      addEventListener(_, callback) { listener = callback; },
      removeEventListener(_, callback) { if (listener === callback) listener = undefined; },
      traverseTo(key) {
        const destination = entries.find(entry => entry.key === key);
        let prevented = false;
        listener?.({ navigationType: 'traverse', cancelable: true, destination, preventDefault() { prevented = true; } });
        if (!prevented) index = Number(key);
        return { finished: Promise.resolve() };
      },
    },
  };
  return { target, entries, get index() { return index; } };
}
test('modern history cancels back/forward/multi-step without rewriting entries and accepts exact destination', () => {
  const browser = modernBrowser(); let proceed;
  const before = JSON.stringify(browser.entries);
  const cleanup = guardLinkHistory(browser.target, false, next => { proceed = next; });
  for (const key of ['0','2','3','0']) {
    browser.target.navigation.traverseTo(key);
    assert.equal(browser.index, 1);
    assert.equal(JSON.stringify(browser.entries), before);
  }
  browser.target.navigation.traverseTo('3'); proceed();
  assert.equal(browser.index, 3);
  assert.equal(JSON.stringify(browser.entries), before);
  cleanup();
});
test('modern history blocks during save and allows an already approved exit', () => {
  const browser = modernBrowser(); let approved = false;
  const cleanup = guardLinkHistory(browser.target, true, () => assert.fail('save must block'), () => approved);
  browser.target.navigation.traverseTo('2'); assert.equal(browser.index,1);
  approved = true; browser.target.navigation.traverseTo('2'); assert.equal(browser.index,2);
  cleanup();
});

import { shouldConfirmLinkExit } from '../app/(private)/dashboard/_views/exploration/lib/link-exit-policy.ts';
const click = {button:0,metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,defaultPrevented:false};
const current = 'https://example.com/dashboard?view=exploration&tab=links&linkEditor=new';
test('menus, logo, other drafts and external same-window links require confirmation', () => {
  for (const href of ['/dashboard','/dashboard?view=profile','/dashboard?view=exploration&tab=links&linkEditor=another','https://elsewhere.example']) {
    assert.equal(shouldConfirmLinkExit(current,href,'',false,click),true);
  }
});
test('hash-only moves, new tabs, downloads, protocol handlers and modified clicks keep editor intact', () => {
  for (const [href,target,download,event] of [[current+'#canvas','',false,click],[current,'',false,click],['/other','_blank',false,click],['/other','preview',false,click],['/other','',true,click],['mailto:test@example.com','',false,click],['tel:1234','',false,click],['/other','',false,{...click,ctrlKey:true}],['/other','',false,{...click,metaKey:true}],['/other','',false,{...click,shiftKey:true}],['/other','',false,{...click,button:1}],['/other','',false,{...click,defaultPrevented:true}]]) {
    assert.equal(shouldConfirmLinkExit(current,href,target,download,event),false);
  }
});

import { requestNavigationExit, navigationExitFailed, NAVIGATION_EXIT_REQUEST, NAVIGATION_EXIT_FAILED } from '../lib/navigation/exit-request.ts';
test('role/session action executes only after confirmation and supports failure notification', () => {
  const previous = globalThis.window;
  const events = new EventTarget(); globalThis.window = events;
  try {
    let actionCalls = 0, proceed, failures = 0;
    events.addEventListener(NAVIGATION_EXIT_REQUEST, event => { event.preventDefault(); proceed = event.detail.proceed; });
    events.addEventListener(NAVIGATION_EXIT_FAILED, () => { failures++; });
    requestNavigationExit(() => { actionCalls++; });
    assert.equal(actionCalls,0);
    proceed(); assert.equal(actionCalls,1);
    navigationExitFailed(); assert.equal(failures,1);
  } finally { globalThis.window = previous; }
});
test('outside a protected editor, role/session actions proceed normally', () => {
  const previous = globalThis.window; globalThis.window = new EventTarget();
  try { let calls = 0; requestNavigationExit(() => { calls++; }); assert.equal(calls,1); }
  finally { globalThis.window = previous; }
});
