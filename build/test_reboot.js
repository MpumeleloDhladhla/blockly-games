#!/usr/bin/env node
/**
 * Guardrails for Reboot, the single-file story game.
 * Run: node build/test_reboot.js
 *
 * Reboot has no Closure build step, so these checks stand in for one:
 * they keep the file self-contained, keep its ten acts wired to the hub's
 * progress keys, and keep the key names right on Windows machines.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GAME = path.join(ROOT, 'appengine', 'reboot.html');
let passed = 0;

function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}

const html = fs.readFileSync(GAME, 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

test('the game is one self-contained file', () => {
  assert.strictEqual(fs.existsSync(GAME), true, 'appengine/reboot.html missing');
  // Exactly one inline script, one inline style, and nothing fetched.
  assert.strictEqual((html.match(/<script/g) || []).length, 1);
  assert.strictEqual((html.match(/<style>/g) || []).length, 1);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.doesNotMatch(html, /<link[^>]+stylesheet/);
  assert.doesNotMatch(html, /https?:\/\/(?!www\.w3\.org)/);
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic|ajax\.googleapis/);
});

test('both parts are wired into the story', () => {
  assert.match(script, /const TIMELINE_1 = \[/);
  assert.match(script, /const TIMELINE_2 = \[/);
  // Ten act cards, numbered 1 to 10, each with a title and a subtitle.
  const cards = script.match(/^\s*card\(\d+,/gm) || [];
  assert.strictEqual(cards.length, 10, 'expected 10 act cards, found ' + cards.length);
  for (let n = 1; n <= 10; n++) {
    assert.ok(new RegExp('card\\(' + n + ',').test(script), 'no card for act ' + n);
  }
  assert.match(script, /const TOTAL_ACTS\s+= 10;/);
  assert.match(script, /const ACTS_IN_PART_1 = 4;/);
});

test('progress keys match what the hub reads', () => {
  // The game writes reboot<N>; the hub counts reboot1..reboot10.
  assert.match(script, /window\.localStorage\['reboot' \+ n\] = '1'/);
  assert.match(script, /markActDone\(currentAct\)/);
  assert.match(script, /partOneFinished/);

  const hub = fs.readFileSync(path.join(ROOT, 'appengine', 'index', 'hub.js'), 'utf8');
  const hubHas = (re, what) => assert.ok(re.test(hub), 'hub.js: ' + what);
  hubHas(/var APPS = \[[^\]]*'reboot'/, 'reboot missing from APPS');
  hubHas(/if \(app === 'reboot'\)[\s\S]{0,120}levels: 10/, 'reboot should count 10 acts');
  hubHas(/var REBOOT_EXTRA_KEYS = \[[^\]]*'reboot_ending'/, 'clear data must remove reboot_ending');
  hubHas(/var REBOOT_EXTRA_KEYS = \[[^\]]*'reboot_part'/, 'clear data must remove reboot_part');
  hubHas(/function clearData\(\)[\s\S]*?REBOOT_EXTRA_KEYS/, 'clearData must purge the reboot keys');
});

test('the hub links to the game and ships its art', () => {
  const index = fs.readFileSync(path.join(ROOT, 'appengine', 'index.html'), 'utf8');
  assert.match(index, /thinka-card--reboot/);
  assert.match(index, /href="reboot\.html"/);
  assert.match(index, /index\/art\/reboot\.svg/);
  assert.match(index, /id="stars-reboot"/);
  assert.match(index, /id="progress-reboot"/);

  const src = fs.readFileSync(path.join(ROOT, 'appengine', 'index', 'src', 'html.js'), 'utf8');
  assert.match(src, /appLink_\(ij, 'reboot', 'Games\.reboot'/);

  const art = path.join(ROOT, 'appengine', 'index', 'art', 'reboot.svg');
  assert.strictEqual(fs.existsSync(art), true, 'reboot.svg missing');
  assert.match(fs.readFileSync(art, 'utf8'), /<svg/);
});

test('the Reboot name is translatable', () => {
  const msgs = JSON.parse(fs.readFileSync(path.join(ROOT, 'messages.json'), 'utf8'));
  assert.ok(msgs['Games.reboot'], 'messages.json is missing Games.reboot');
  assert.strictEqual(msgs['Games.reboot'].msg, 'Reboot');
  const en = JSON.parse(fs.readFileSync(path.join(ROOT, 'json', 'en.json'), 'utf8'));
  assert.strictEqual(en['Games.reboot'], 'Reboot');
  const qqq = JSON.parse(fs.readFileSync(path.join(ROOT, 'json', 'qqq.json'), 'utf8'));
  assert.ok(qqq['Games.reboot'], 'qqq.json is missing Games.reboot');
});

test('key names follow the machine, and CTRL is the default', () => {
  // Windows and Chromebooks must be told CTRL, never CMD.
  assert.match(script, /const isMac = .*!\/windows\/i\.test\(PLATFORM\)/);
  assert.match(script, /const CMD\s+= isMac \? 'CMD' : 'CTRL'/);
  // Every shortcut accepts either modifier, so a stray keyboard still works.
  assert.doesNotMatch(script, /e\.metaKey && !e\.ctrlKey/);
  assert.ok(/ctrlKey \|\| e\.metaKey/.test(script), 'shortcuts should accept both modifiers');
  // No hand-written CMD or CTRL in player-facing strings.
  assert.doesNotMatch(script, /'(CTRL|CMD) \+ ENTER'/);
});

test('failure is always recoverable', () => {
  assert.match(script, /const RESYNC_SECONDS = 7;/);
  // Every task that can be failed offers a tip on the way back in.
  const tasks = (script.match(/^TASKS\.\w+ = \{/gm) || []).length;
  assert.ok(tasks >= 20, 'expected at least 20 tasks, found ' + tasks);
  assert.match(script, /await resync\(task\.retryTip\)/);
  // Damage tops itself back up rather than ending the run.
  assert.match(script, /State\.integrity = 45;/);
});

test('the player picks easy or hard before anything starts', () => {
  assert.match(script, /HOW DO YOU WANT TO PLAY\?/);
  assert.match(script, /chooseMode\('easy', true\)/, 'easy should be the default');
  assert.match(script, /const HARD_LIVES = 3;/);
  // Hard spends a life per failure and rewinds the act when they run out.
  assert.match(script, /State\.lives--/);
  assert.match(script, /if \(State\.lives <= 0\) return 'restart-act'/);
  assert.match(script, /outcome === 'restart-act'/);
  assert.match(script, /i = actStart;/, 'the act has to rewind to its own card');
  // Easy keeps handing out extra time; hard does not.
  assert.match(script, /State\.mode === 'hard' \? 1 : 1 \+ 0\.25 \* \(tries - 1\)/);
});

test('finishing everything earns a printable certificate', () => {
  assert.match(script, /askNameThenCertificate/);
  assert.match(script, /function showCertificate\(name, timePlayed, accuracy\)/);
  assert.match(script, /CERTIFICATE OF COMPLETION/);
  assert.match(script, /window\.print\(\)/);
  assert.match(script, /localStorage\['reboot_name'\]/);
  // Print styles exist, so the award does not come out as a black rectangle.
  assert.match(html, /@media print\{/);
  const hub = fs.readFileSync(path.join(ROOT, 'appengine', 'index', 'hub.js'), 'utf8');
  assert.ok(/REBOOT_EXTRA_KEYS = \[[^\]]*'reboot_name'/.test(hub),
      'hub.js: clear data must remove reboot_name');
});

test('the player can always get back to the hub', () => {
  assert.match(html, /id="exitLink" href="index\.html"/);
  assert.match(script, /menu\.href = 'index\.html'/);
});

console.log('\n' + passed + ' tests passed');
