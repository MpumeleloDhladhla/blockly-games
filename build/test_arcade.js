#!/usr/bin/env node
/**
 * Unit tests for the Arcade curriculum, scoring, engine, and leaderboard.
 * Run: node build/test_arcade.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadModule(rel, sandbox) {
  sandbox.goog = sandbox.goog || {
    provide: function(name) {
      const parts = name.split('.');
      let obj = sandbox;
      for (const part of parts) {
        obj[part] = obj[part] || {};
        obj = obj[part];
      }
    },
    require: function() {},
  };
  const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox;
}

const sandbox = {};
loadModule('appengine/arcade/src/levels.js', sandbox);
loadModule('appengine/arcade/src/scoring.js', sandbox);
loadModule('appengine/arcade/src/engine.js', sandbox);
loadModule('appengine/arcade/src/board.js', sandbox);
const Levels = sandbox.Arcade.Levels;
const Scoring = sandbox.Arcade.Scoring;
const Engine = sandbox.Arcade.Engine;
const Board = sandbox.Arcade.Board;

let passed = 0;

function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}

function read(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}

// Objects built inside the vm sandbox carry the sandbox's prototypes, which
// deepStrictEqual rejects.  Round-trip them into plain host objects first.
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}


// --------------------------------------------------------------- Curriculum

test('five zones of four levels each', () => {
  assert.strictEqual(Levels.ZONE_IDS.join(','), 'pop,drag,catch,zap,combo');
  for (const id of Levels.ZONE_IDS) {
    const zone = Levels.getZone(id);
    assert.ok(zone, id + ' is missing');
    assert.strictEqual(zone.levels.length, 4, id + ' should have 4 levels');
  }
  assert.strictEqual(Levels.totalLevels(), 20);
  assert.strictEqual(Levels.getZone('nope'), null);
});

test('storage names match the hub progress keys', () => {
  assert.deepStrictEqual(plain(Levels.storageNames()), [
    {name: 'arcade_pop', levels: 4},
    {name: 'arcade_drag', levels: 4},
    {name: 'arcade_catch', levels: 4},
    {name: 'arcade_zap', levels: 4},
    {name: 'arcade_combo', levels: 4},
  ]);
});

test('three stars continues into the next level, then the next game', () => {
  assert.deepStrictEqual(plain(Levels.nextGame('pop', 1)),
      {zone: 'pop', level: 2});
  assert.deepStrictEqual(plain(Levels.nextGame('pop', 3)),
      {zone: 'pop', level: 4});
  assert.deepStrictEqual(plain(Levels.nextGame('pop', 4)),
      {zone: 'drag', level: 1});
  assert.deepStrictEqual(plain(Levels.nextGame('zap', 4)),
      {zone: 'combo', level: 1});
  assert.strictEqual(Levels.nextGame('combo', 4), null);
  assert.strictEqual(Levels.nextGame('nope', 1), null);
  assert.strictEqual(Levels.nextGame('pop', 0), null);

  const main = read('appengine/arcade/src/main.js');
  assert.match(main, /stats\.stars >= 3/);
  assert.match(main, /primary = 'Continue'/);
  assert.match(main, /Arcade\.Levels\.nextGame/);
});

test('level ids are unique and cover every level', () => {
  const ids = Levels.allLevelIds();
  assert.strictEqual(ids.length, Levels.totalLevels());
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.strictEqual(ids[0], 'pop1');
  assert.strictEqual(ids[ids.length - 1], 'combo4');
  assert.strictEqual(Levels.levelId('zap', 3), 'zap3');
});

test('every level is playable: rounds, thresholds, and a clock', () => {
  for (const id of Levels.ZONE_IDS) {
    const zone = Levels.getZone(id);
    assert.ok(zone.title && zone.blurb && zone.help && zone.kicker, id);
    assert.ok(['mouse', 'keys', 'both'].indexOf(zone.input) !== -1, id);
    assert.strictEqual(zone.storage, 'arcade_' + id);
    for (let lv = 1; lv <= zone.levels.length; lv++) {
      const level = Levels.getLevel(zone, lv);
      const where = id + lv;
      assert.ok(level.title && level.hint, where + ' needs copy');
      assert.ok(level.rounds >= 4, where + ' has too few rounds');
      assert.ok(level.target > level.par, where + ' target must beat par');
      assert.ok(level.par > 0, where + ' needs a positive par');
      // Every zone needs a clock so the time bonus and the HUD bar work.
      assert.ok(Engine.budgetMs(level) > 0, where + ' has no clock');
    }
    assert.strictEqual(Levels.getLevel(zone, 5), null);
  }
});

test('difficulty climbs across each zone', () => {
  for (const id of Levels.ZONE_IDS) {
    const levels = Levels.getZone(id).levels;
    for (let i = 1; i < levels.length; i++) {
      assert.ok(levels[i].par > levels[i - 1].par,
          id + ' level ' + (i + 1) + ' should ask for more than the one before');
    }
  }
});

test('keyboard zones only ever ask for a single character', () => {
  for (const id of ['zap', 'combo']) {
    for (const level of Levels.getZone(id).levels) {
      assert.ok(level.pool && level.pool.length > 1, id + ' needs a key pool');
      assert.match(level.pool, /^[a-z0-9]+$/,
          id + ' pool must be plain lowercase keys');
    }
  }
});

test('drag never needs more shapes than the game can draw', () => {
  // main.js draws from a fixed list of seven shape classes.
  const shapes = read('appengine/arcade/src/main.js')
      .match(/const SHAPES = \[([^\]]+)\]/)[1]
      .split(',').filter((s) => s.trim()).length;
  for (const level of Levels.getZone('drag').levels) {
    assert.ok(level.rounds <= shapes,
        'drag wants ' + level.rounds + ' shapes but only ' + shapes + ' exist');
  }
});


// ------------------------------------------------------------------ Scoring

test('a hit is worth more inside a streak, up to the cap', () => {
  assert.strictEqual(Scoring.hitPoints(1), 100);
  assert.strictEqual(Scoring.hitPoints(2), 120);
  assert.strictEqual(Scoring.hitPoints(3), 140);
  assert.strictEqual(Scoring.hitPoints(6), 200);
  // Capped, so a long run cannot run away with the round.
  assert.strictEqual(Scoring.hitPoints(9), 200);
  assert.strictEqual(Scoring.hitPoints(0), 100);
});

test('misses subtract and a finished round banks the time bonus', () => {
  assert.strictEqual(
      Scoring.finalScore({base: 1000, misses: 0, msLeft: 0, done: true}), 1000);
  assert.strictEqual(
      Scoring.finalScore({base: 1000, misses: 3, msLeft: 0, done: true}), 880);
  // 4 whole seconds left x 5 points.
  assert.strictEqual(
      Scoring.finalScore({base: 1000, misses: 0, msLeft: 4600, done: true}),
      1020);
  // No bonus for a round that ran out of time.
  assert.strictEqual(
      Scoring.finalScore({base: 1000, misses: 0, msLeft: 4600, done: false}),
      1000);
  // Never negative.
  assert.strictEqual(
      Scoring.finalScore({base: 100, misses: 50, msLeft: 0, done: true}), 0);
});

test('stars need a finished round and a score above zero', () => {
  const level = {par: 800, target: 1200};
  assert.strictEqual(Scoring.starsFor(level, 1300, true), 3);
  assert.strictEqual(Scoring.starsFor(level, 1200, true), 3);
  assert.strictEqual(Scoring.starsFor(level, 800, true), 2);
  assert.strictEqual(Scoring.starsFor(level, 10, true), 1);
  assert.strictEqual(Scoring.starsFor(level, 0, true), 0);
  assert.strictEqual(Scoring.starsFor(level, 1300, false), 0);
});

test('accuracy counts hits against every attempt', () => {
  assert.strictEqual(Scoring.accuracy(0, 0), 100);
  assert.strictEqual(Scoring.accuracy(8, 2), 80);
  assert.strictEqual(Scoring.accuracy(0, 4), 0);
});


// ------------------------------------------------------------------- Engine

test('the clock is the level time, or the worst-case reaction time', () => {
  assert.strictEqual(Engine.budgetMs({time: 45000, rounds: 4}), 45000);
  assert.strictEqual(Engine.budgetMs({rounds: 10, life: 2000}), 20000);
  assert.strictEqual(Engine.budgetMs({rounds: 10, fallMs: 3000}), 30000);
  assert.strictEqual(Engine.budgetMs(null), 0);
});

test('hits and misses drive the streak and the chance count', () => {
  const run = new Engine({rounds: 3, life: 1000, par: 1, target: 2});
  run.start(0);
  assert.strictEqual(run.hit(0), 100);
  assert.strictEqual(run.hit(0), 120);
  assert.strictEqual(run.streak, 2);
  assert.strictEqual(run.bestStreak, 2);
  run.miss(0);
  assert.strictEqual(run.streak, 0);
  assert.strictEqual(run.bestStreak, 2);
  assert.strictEqual(run.resolved, 3);
  assert.strictEqual(run.isComplete(), true);
});

test('a penalty costs points without using up a chance', () => {
  const run = new Engine({rounds: 2, life: 1000, par: 1, target: 2});
  run.start(0);
  run.hit(0);
  run.penalty(0);
  assert.strictEqual(run.misses, 1);
  assert.strictEqual(run.resolved, 1, 'penalty must not consume a chance');
  assert.strictEqual(run.streak, 0);
  assert.strictEqual(run.isComplete(), false);
});

test('the round ends when the clock runs out', () => {
  const level = {rounds: 4, life: 1000, par: 1, target: 2};
  const run = new Engine(level);
  run.start(0);
  assert.strictEqual(run.budgetMs, 4000);
  assert.strictEqual(run.msLeft(1000), 3000);
  assert.strictEqual(run.isTimeUp(3999), false);
  assert.strictEqual(run.isTimeUp(4000), true);
  assert.strictEqual(run.msLeft(9000), 0);
});

test('a finished engine reports the score and stars it earned', () => {
  const level = {rounds: 2, life: 5000, par: 200, target: 400};
  const run = new Engine(level);
  run.start(0);
  run.hit(0);
  run.hit(0);
  run.finish(1000);
  const stats = run.stats();
  assert.strictEqual(stats.done, true);
  assert.strictEqual(stats.base, 220);
  // 9 whole seconds left of the 10s budget x 5.
  assert.strictEqual(stats.msLeft, 9000);
  assert.strictEqual(stats.score, 265);
  assert.strictEqual(stats.stars, 2);
  assert.strictEqual(stats.accuracy, 100);
});

test('a stopped engine ignores late input', () => {
  const run = new Engine({rounds: 5, life: 1000, par: 1, target: 2});
  run.start(0);
  run.finish(10);
  assert.strictEqual(run.hit(20), 0);
  run.miss(20);
  run.penalty(20);
  assert.strictEqual(run.hits, 0);
  assert.strictEqual(run.misses, 0);
});


// -------------------------------------------------------------- Leaderboard

test('names are trimmed, collapsed, and capped', () => {
  assert.strictEqual(Board.cleanName('  Sam  '), 'Sam');
  assert.strictEqual(Board.cleanName('Sam   T'), 'Sam T');
  assert.strictEqual(Board.cleanName('Sam\tT\nB'), 'Sam T B');
  assert.strictEqual(Board.cleanName(''), '');
  assert.strictEqual(Board.cleanName(null), '');
  assert.strictEqual(Board.cleanName('   '), '');
  assert.strictEqual(Board.cleanName('abcdefghijklmnopq').length,
      Board.MAX_NAME);
});

test('scores sort high first, earliest wins a tie', () => {
  let data = {};
  data = Board.record(data, 'pop1', 'Ann', 300, 20);
  data = Board.record(data, 'pop1', 'Bo', 500, 30);
  data = Board.record(data, 'pop1', 'Cy', 300, 10);
  const top = Board.top(data, 'pop1');
  assert.deepStrictEqual(plain(top.map((e) => e['name'])), ['Bo', 'Cy', 'Ann']);
});

test('each player keeps one slot per level, holding their best', () => {
  let data = {};
  data = Board.record(data, 'pop1', 'Ann', 300, 10);
  data = Board.record(data, 'pop1', 'Ann', 900, 20);
  data = Board.record(data, 'pop1', 'ann', 100, 30);
  const top = Board.top(data, 'pop1');
  assert.strictEqual(top.length, 1, 'one row per player');
  assert.strictEqual(top[0]['score'], 900, 'a weaker replay must not count');
  assert.strictEqual(top[0]['name'], 'ann', 'latest spelling is shown');
});

test('a level keeps only the top five', () => {
  let data = {};
  for (let i = 1; i <= 8; i++) {
    data = Board.record(data, 'zap2', 'Kid' + i, i * 100, i);
  }
  const top = Board.top(data, 'zap2');
  assert.strictEqual(top.length, Board.MAX_PER_LEVEL);
  assert.deepStrictEqual(plain(top.map((e) => e['score'])),
      [800, 700, 600, 500, 400]);
});

test('blank names and blank levels are not recorded', () => {
  let data = {};
  data = Board.record(data, 'pop1', '   ', 900, 1);
  data = Board.record(data, '', 'Ann', 900, 1);
  assert.deepStrictEqual(plain(data), {});
  assert.deepStrictEqual(plain(Board.top(data, 'pop1')), []);
});

test('champions add each player best score across levels', () => {
  let data = {};
  data = Board.record(data, 'pop1', 'Ann', 300, 1);
  data = Board.record(data, 'pop2', 'Ann', 400, 2);
  data = Board.record(data, 'pop1', 'Bo', 600, 3);
  assert.deepStrictEqual(plain(Board.champions(data, ['pop1', 'pop2'])), [
    {name: 'Ann', total: 700, levels: 2},
    {name: 'Bo', total: 600, levels: 1},
  ]);
});

test('champions break a tie on name so the order is stable', () => {
  let data = {};
  data = Board.record(data, 'pop1', 'Zoe', 500, 1);
  data = Board.record(data, 'pop1', 'Ada', 500, 2);
  const rows = Board.champions(data, ['pop1']);
  assert.deepStrictEqual(plain(rows.map((r) => r['name'])), ['Ada', 'Zoe']);
});

test('the board round-trips through storage', () => {
  const store = {};
  let data = Board.load(store);
  assert.deepStrictEqual(plain(data), {});
  data = Board.record(data, 'combo4', 'Ann', 750, 99);
  Board.save(store, data);
  assert.ok(store[Board.SCORES_KEY], 'nothing was written');
  const reloaded = Board.load(store);
  assert.strictEqual(reloaded['combo4'][0]['name'], 'Ann');
  assert.strictEqual(reloaded['combo4'][0]['score'], 750);
});

test('a corrupt or hostile blob reads as empty instead of throwing', () => {
  assert.deepStrictEqual(plain(Board.load({'arcade_scores': 'not json'})), {});
  assert.deepStrictEqual(plain(Board.load({'arcade_scores': 'null'})), {});
  assert.deepStrictEqual(plain(Board.load({'arcade_scores': '"a string"'})), {});
  assert.deepStrictEqual(plain(Board.load({'arcade_scores': '{"pop1": 5}'})), {});
  assert.deepStrictEqual(plain(Board.load({})), {});
  assert.deepStrictEqual(plain(Board.load(null)), {});
  // Entries missing a name or a usable score are dropped.
  const partial = Board.load({'arcade_scores':
      '{"pop1":[{"name":"Ann","score":10},{"score":99},{"name":"Bo"}]}'});
  assert.strictEqual(partial['pop1'].length, 1);
  assert.strictEqual(partial['pop1'][0]['name'], 'Ann');
});

test('storage failures never escape', () => {
  const angry = {};
  Object.defineProperty(angry, Board.SCORES_KEY, {
    get() { throw new Error('SecurityError'); },
    set() { throw new Error('SecurityError'); },
  });
  assert.deepStrictEqual(plain(Board.load(angry)), {});
  Board.save(angry, {'pop1': []});
});

test('the current player is remembered and can be cleared', () => {
  const store = {};
  assert.strictEqual(Board.getPlayer(store), '');
  assert.strictEqual(Board.setPlayer(store, '  Ann  '), 'Ann');
  assert.strictEqual(Board.getPlayer(store), 'Ann');
  assert.strictEqual(Board.setPlayer(store, '  '), '');
  assert.strictEqual(Board.getPlayer(store), '');
});


// ----------------------------------------------------------- Wiring / build

test('the hub knows about Arcade and sizes it from the real curriculum', () => {
  const hub = read('appengine/index/hub.js');
  const match = hub.match(/var ARCADE_STORAGE = (\[[\s\S]*?\n  \]);/);
  assert.ok(match, 'ARCADE_STORAGE is missing from index/hub.js');
  const declared = vm.runInNewContext('(' + match[1] + ')');
  assert.deepStrictEqual(plain(declared), plain(Levels.storageNames()),
      'index/hub.js has stale Arcade progress metadata');
  assert.match(hub, /'arcade'/);
  assert.match(hub, /ARCADE_EXTRA_KEYS/);
});

test('hub Clear data removes the leaderboard and the player name', () => {
  const hub = read('appengine/index/hub.js');
  const keys = vm.runInNewContext(
      '(' + hub.match(/var ARCADE_EXTRA_KEYS = (\[[^\]]*\]);/)[1] + ')');
  assert.ok(keys.indexOf(Board.SCORES_KEY) !== -1,
      'Clear data would leave ' + Board.SCORES_KEY + ' behind');
  assert.ok(keys.indexOf(Board.PLAYER_KEY) !== -1,
      'Clear data would leave ' + Board.PLAYER_KEY + ' behind');
  // The purge has to actually run inside clearData.
  const clearData = hub.match(/function clearData\(\)[\s\S]*?\n  \}/)[0];
  assert.match(clearData, /ARCADE_EXTRA_KEYS/);
});

test('Arcade is a first-class game in the hub and the build', () => {
  const index = read('appengine/index.html');
  assert.match(index, /id="card-arcade"/);
  assert.match(index, /arcade\.html/);
  assert.match(index, /index\/art\/arcade\.svg/);
  assert.match(index, /id="progress-arcade"/);
  assert.match(index, /id="stars-arcade"/);

  const hubHtml = read('appengine/index/src/html.js');
  assert.match(hubHtml, /Games\.arcade/);

  const style = read('appengine/index/style.css');
  assert.match(style, /\.thinka-card--arcade/);

  const makefile = read('Makefile');
  assert.match(makefile, /^arcade: common$/m);
  assert.match(makefile, /^games:.*\barcade\b/m);
  assert.match(makefile, /^\tnode build\/test_arcade\.js$/m);
  assert.match(makefile, /clean-games[\s\S]*?\barcade\b/);

  const messages = JSON.parse(read('messages.json'));
  assert.ok(messages['Games.arcade'], 'messages.json needs Games.arcade');
  assert.strictEqual(messages['Games.arcade'].msg, 'Arcade');
  assert.strictEqual(JSON.parse(read('json/en.json'))['Games.arcade'],
      'Arcade');
  assert.ok(JSON.parse(read('json/qqq.json'))['Games.arcade'],
      'json/qqq.json needs Games.arcade');
});

test('the page shell is offline-first', () => {
  const page = read('appengine/arcade.html');
  assert.match(page, /arcade\/style\.css/);
  assert.match(page, /common\/boot\.js/);
  assert.doesNotMatch(page, /fonts\.googleapis/);
  assert.doesNotMatch(page, /https?:\/\//);
});

test('free play: Arcade opts out of the shared level locks', () => {
  const lib = read('appengine/src/lib-games.js');
  assert.match(lib, /BlocklyGames\.SKIP_LEVEL_LOCKS = false;/);
  // The guard has to be the first thing initLevelLocks_ does.
  const locks = lib.match(
      /BlocklyGames\.initLevelLocks_ = function\(\) \{\n([\s\S]*?)\n  \}/);
  assert.match(locks[1], /^  if \(BlocklyGames\.SKIP_LEVEL_LOCKS\) \{/);
  assert.match(read('appengine/arcade/src/main.js'),
      /BlocklyGames\.SKIP_LEVEL_LOCKS = true;/);
});

console.log('\n' + passed + ' tests passed');
