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

test('five zones of six levels, two of them warm-ups', () => {
  assert.strictEqual(Levels.ZONE_IDS.join(','), 'pop,drag,catch,zap,combo');
  assert.strictEqual(Levels.LEVELS_PER_ZONE, 6);
  assert.strictEqual(Levels.WARMUP_COUNT, 2);
  for (const id of Levels.ZONE_IDS) {
    const zone = Levels.getZone(id);
    assert.ok(zone, id + ' is missing');
    assert.strictEqual(zone.levels.length, 6, id + ' should have 6 levels');
  }
  assert.strictEqual(Levels.totalLevels(), 30);
  assert.strictEqual(Levels.getZone('nope'), null);
});

test('storage names match the hub progress keys', () => {
  assert.deepStrictEqual(plain(Levels.storageNames()), [
    {name: 'arcade_pop', levels: 6},
    {name: 'arcade_drag', levels: 6},
    {name: 'arcade_catch', levels: 6},
    {name: 'arcade_zap', levels: 6},
    {name: 'arcade_combo', levels: 6},
  ]);
});

test('three stars continues into the next level, then the next game', () => {
  assert.deepStrictEqual(plain(Levels.nextGame('pop', 1)),
      {zone: 'pop', level: 2});
  assert.deepStrictEqual(plain(Levels.nextGame('pop', 5)),
      {zone: 'pop', level: 6});
  assert.deepStrictEqual(plain(Levels.nextGame('pop', 6)),
      {zone: 'drag', level: 1});
  assert.deepStrictEqual(plain(Levels.nextGame('zap', 6)),
      {zone: 'combo', level: 1});
  assert.strictEqual(Levels.nextGame('combo', 6), null);
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
  assert.strictEqual(ids[ids.length - 1], 'combo6');
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
    assert.ok(Levels.getLevel(zone, 6), id + ' level 6 should exist');
    assert.strictEqual(Levels.getLevel(zone, 7), null);
  }
});

test('the first two levels of every zone are a gentle on-ramp', () => {
  const pop = Levels.getZone('pop').levels;
  assert.ok(pop[0].size > pop[1].size, 'pop warm-up 1 is the biggest');
  assert.ok(pop[0].life > pop[2].life, 'pop warm-up outlasts the old first level');
  assert.strictEqual(pop[0].bombs, 0);
  assert.strictEqual(pop[1].bombs, 0);
  assert.ok(pop[0].rounds < pop[2].rounds);

  const drag = Levels.getZone('drag').levels;
  assert.ok(drag[0].slack > drag[2].slack);
  assert.ok(drag[0].time > drag[2].time);
  assert.ok(drag[0].size > drag[2].size);
  assert.strictEqual(drag[0].rounds, 4);

  const caught = Levels.getZone('catch').levels;
  assert.ok(caught[0].fallMs > caught[2].fallMs);
  assert.ok(caught[0].speed < caught[2].speed);
  assert.strictEqual(caught[0].bad, 0);
  assert.ok(caught[0].rounds < caught[2].rounds);

  const zap = Levels.getZone('zap').levels;
  assert.ok(zap[0].life > zap[2].life);
  assert.ok(zap[0].pool.length < zap[2].pool.length);
  assert.strictEqual(zap[0].pool, 'asdf');

  const combo = Levels.getZone('combo').levels;
  assert.ok(combo[0].size > combo[2].size);
  assert.ok(combo[0].life > combo[2].life);
  assert.strictEqual(combo[0].pool, 'asdf');
});

test('climbing levels are slower than the original four-level curriculum', () => {
  // Original Pop 1 was 92px / 2400ms / 12 bubbles.
  // Original Pop 4 was 52px / 1300ms / 18 bubbles / 6 bombs.
  const pop = Levels.getZone('pop').levels;
  assert.ok(pop[0].size > 92 && pop[0].life > 2400, 'pop opens slower');
  assert.ok(pop[2].size > 92 && pop[2].life > 2400, 'old pop 1 is now easier');
  assert.ok(pop[5].size > 52 && pop[5].life > 1300, 'old pop 4 is now easier');
  assert.ok(pop[5].rounds > 18, 'pop finale is longer than 18 bubbles');
  assert.ok(pop[5].bombs < 6);

  // Catch is back on the original four-level pace, spread over six levels.
  // Original Catch 1: fall 3800 / speed 430 / 10 drops / basket 0.16 / gap 0.55.
  // Original Catch 2: fall 3200 / speed 460 / 12 drops / 3 rocks.
  // Original Catch 3: fall 2700 / speed 500 / 14 drops / 5 rocks.
  // Original Catch 4: fall 2200 / speed 540 / 16 drops / 7 rocks.
  const caught = Levels.getZone('catch').levels;
  assert.strictEqual(caught[0].fallMs, 3800);
  assert.strictEqual(caught[0].speed, 430);
  assert.strictEqual(caught[0].rounds, 10);
  assert.strictEqual(caught[0].bad, 0);
  assert.strictEqual(caught[0].basket, 0.16);
  assert.strictEqual(caught[0].gap, 0.55);

  assert.strictEqual(caught[1].fallMs, 3500);
  assert.strictEqual(caught[1].speed, 445);
  assert.strictEqual(caught[1].rounds, 11);
  assert.strictEqual(caught[1].bad, 2);

  assert.strictEqual(caught[2].fallMs, 3200);
  assert.strictEqual(caught[2].speed, 460);
  assert.strictEqual(caught[2].rounds, 12);
  assert.strictEqual(caught[2].bad, 3);

  assert.strictEqual(caught[3].fallMs, 2700);
  assert.strictEqual(caught[3].speed, 500);
  assert.strictEqual(caught[3].rounds, 14);
  assert.strictEqual(caught[3].bad, 5);

  assert.strictEqual(caught[4].fallMs, 2450);
  assert.strictEqual(caught[4].speed, 520);
  assert.strictEqual(caught[4].rounds, 16);
  assert.strictEqual(caught[4].bad, 6);

  assert.strictEqual(caught[5].fallMs, 2200);
  assert.strictEqual(caught[5].speed, 540);
  assert.strictEqual(caught[5].bad, 7);
  assert.strictEqual(caught[5].rounds, 18);
  assert.strictEqual(caught[5].basket, 0.16);
  assert.strictEqual(caught[5].gap, 0.55);

  for (let i = 1; i < caught.length; i++) {
    assert.ok(caught[i].fallMs < caught[i - 1].fallMs, 'catch fall speeds up');
    assert.ok(caught[i].speed > caught[i - 1].speed, 'catch basket speeds up');
    assert.ok(caught[i].rounds > caught[i - 1].rounds, 'catch adds drops');
    assert.ok(caught[i].bad >= caught[i - 1].bad, 'catch rocks do not drop off');
    assert.strictEqual(caught[i].basket, 0.16);
    assert.strictEqual(caught[i].gap, 0.55);
  }
  assert.strictEqual(Levels.CATCH_BASKET_DEFAULT, 0.16);
  assert.strictEqual(Levels.CATCH_SPAWN_GAP_DEFAULT, 0.55);

  const drag = Levels.getZone('drag').levels;
  // Original drag 1: slack 58, clock 45000. Original drag 4: slack 30,
  // clock 38000, 7 shapes (the drawing cap, so the finale grows by time).
  assert.ok(drag[0].slack > 58 && drag[0].time > 45000);
  assert.ok(drag[2].slack > 58 && drag[2].time > 45000);
  assert.ok(drag[5].slack > 30 && drag[5].time > 38000);
  assert.strictEqual(drag[5].rounds, 7);
  assert.ok(drag[5].time > drag[4].time, 'the drag finale keeps the long clock');

  const zap = Levels.getZone('zap').levels;
  assert.ok(zap[0].life > 2800, 'zap opens slower than the original 2800ms');
  assert.ok(zap[2].life > 2800);
  assert.ok(zap[5].life > 1500);
  assert.ok(zap[5].rounds > 16, 'zap finale is longer than 16 keys');

  const combo = Levels.getZone('combo').levels;
  assert.ok(combo[0].life > 3600 && combo[0].size > 96);
  assert.ok(combo[2].life > 3600 && combo[2].size > 96);
  assert.ok(combo[5].life > 2100 && combo[5].size > 60);
  assert.ok(combo[5].rounds > 14, 'combo finale is longer than 14 targets');
});

test('a clean finish can still earn three stars', () => {
  // Reaction games pay the time bonus only for seconds the child did not
  // need, so three stars must be reachable on hits alone. Drag's clock is
  // the whole round, so a third of it left still counts as an unhurried
  // finish rather than a speed run.
  function cleanScore(rounds, msLeft) {
    let base = 0;
    for (let hit = 1; hit <= rounds; hit++) {
      base += Scoring.hitPoints(hit);
    }
    return Scoring.finalScore({
      base: base,
      misses: 0,
      msLeft: msLeft,
      done: true,
    });
  }
  for (const id of Levels.ZONE_IDS) {
    const levels = Levels.getZone(id).levels;
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const msLeft = id === 'drag' ? Math.floor(Engine.budgetMs(level) / 3) : 0;
      const score = cleanScore(level.rounds, msLeft);
      assert.ok(score >= level.target,
          id + (i + 1) + ' clean score ' + score +
          ' is under the three-star line ' + level.target);
    }
  }
});

test('an old four-level save shifts up by the two warm-ups', () => {
  const store = {
    arcade_pop1: '{"score":10}',
    arcade_pop4: '{"score":40}',
    arcade_pop1_stars: '3',
    arcade_pop2_stars: '2',
    arcade_pop4_teacherUnlock: '1',
    arcade_drag3: '{"score":3}',
    arcade_scores: JSON.stringify({
      pop1: [{name: 'Ann', score: 10}],
      pop4: [{name: 'Bo', score: 40}],
      zap2: [{name: 'Cy', score: 20}],
    }),
  };
  Levels.migrateStorage(store);
  assert.strictEqual(store.arcade_curriculum, '6');
  assert.strictEqual(store.arcade_pop1, undefined);
  assert.strictEqual(store.arcade_pop3, '{"score":10}');
  assert.strictEqual(store.arcade_pop6, '{"score":40}');
  assert.strictEqual(store.arcade_pop3_stars, '3');
  assert.strictEqual(store.arcade_pop4_stars, '2');
  assert.strictEqual(store.arcade_pop6_teacherUnlock, '1');
  assert.strictEqual(store.arcade_drag5, '{"score":3}');
  const scores = JSON.parse(store.arcade_scores);
  assert.ok(scores.pop3 && scores.pop6 && scores.zap4);
  assert.strictEqual(scores.pop1, undefined);
  assert.strictEqual(scores.pop3[0].name, 'Ann');

  // A second open must not shift the warm-up progress again.
  store.arcade_pop1 = '{"score":1}';
  Levels.migrateStorage(store);
  assert.strictEqual(store.arcade_pop1, '{"score":1}');
  assert.strictEqual(store.arcade_pop3, '{"score":10}');
});

test('an empty save is stamped and not shifted', () => {
  const store = {};
  Levels.migrateStorage(store);
  assert.strictEqual(store.arcade_curriculum, '6');
  assert.deepStrictEqual(Object.keys(store), ['arcade_curriculum']);
  assert.strictEqual(Levels.migrateStorage(null), null);
});

test('a save that already reached level 5 is not shifted', () => {
  const store = {
    arcade_pop1: '{"score":1}',
    arcade_pop5: '{"score":5}',
  };
  Levels.migrateStorage(store);
  assert.strictEqual(store.arcade_pop1, '{"score":1}');
  assert.strictEqual(store.arcade_pop5, '{"score":5}');
  assert.strictEqual(store.arcade_pop3, undefined);
  assert.strictEqual(store.arcade_curriculum, '6');
});

test('each zone has a how-to card that names only its real controls', () => {
  const pointerWords = /click|tap|mouse|finger|touch/i;
  for (const id of Levels.ZONE_IDS) {
    const zone = Levels.getZone(id);
    const card = zone.explainer;
    assert.ok(card && card.goal && card.steps && card.steps.length,
        id + ' needs an explainer');
    assert.ok(card.goal.length < 90, id + ' goal should stay one short line');
    const kinds = card.steps.map((step) => step.kind);
    const words = card.steps.map((step) => step.text).join(' ');
    if (zone.input === 'keys') {
      assert.ok(kinds.indexOf('pointer') === -1,
          id + ' must not show a mouse or touch control');
      assert.doesNotMatch(words, pointerWords, id);
      assert.ok(kinds.indexOf('keys') !== -1, id);
    }
    if (zone.input === 'mouse') {
      assert.deepStrictEqual(plain(kinds), ['pointer'], id);
      assert.match(words, /click or tap|mouse or your finger/i, id);
    }
    if (zone.input === 'both') {
      assert.ok(kinds.indexOf('pointer') !== -1, id);
      assert.ok(kinds.indexOf('keys') !== -1, id);
    }
    for (const step of card.steps) {
      assert.ok(step.text, id + ' step needs words');
      if (step.kind === 'keys') {
        assert.ok(step.keys && step.keys.length, id + ' keys need faces');
      }
    }
  }
  const catchCard = Levels.getZone('catch').explainer;
  assert.deepStrictEqual(plain(catchCard.steps[0].keys), ['\u2190', '\u2192']);
  assert.match(catchCard.steps[0].text, /arrow keys to move the basket/);
  assert.match(catchCard.goal, /Catch the falling stars/);

  const main = read('appengine/arcade/src/main.js');
  assert.match(main, /ThinkaConfig\.explainedKey\(zone\.storage\)/);
  assert.match(main, /showExplainer\(true\)/);
  assert.match(main, /Let's go/);
  assert.match(main, /e\.key === 'Enter' \|\| e\.key === ' '/);
  const page = read('appengine/arcade/src/html.js');
  assert.match(page, /id="arcadeHow"/);
  assert.match(page, /How to play/);
  assert.match(page, /id="arcadeExplain"/);
  assert.match(page, /id="arcadeExplainGo"/);
  assert.match(page, /Let's go/);
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
  assert.strictEqual(Scoring.MISS_PENALTY, 25);
  assert.strictEqual(
      Scoring.finalScore({base: 1000, misses: 3, msLeft: 0, done: true}), 925);
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
  assert.ok(keys.indexOf('arcade_curriculum') !== -1,
      'Clear data would leave the curriculum stamp behind');
  // The purge has to actually run inside clearData.
  const clearData = hub.match(/function clearData\(\)[\s\S]*?\n  \}/)[0];
  assert.match(clearData, /ARCADE_EXTRA_KEYS/);
  // How-to cards are stored as arcade_pop_explained and the same suffix
  // on the other zones, which this loop already removes.
  assert.match(clearData, /_explained/);
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

test('Pop and Catch stages are 20px taller than the shared playfield', () => {
  const style = read('appengine/arcade/style.css');
  const short = style.match(/@media \(max-height: 800px\) \{([\s\S]*?)\n\}/);
  const shorter = style.match(/@media \(max-height: 700px\) \{([\s\S]*?)\n\}/);
  assert.ok(short, 'short-screen stage rule missing');
  assert.ok(shorter, 'shorter-screen stage rule missing');
  assert.match(short[1], /height: min\(42vh, 22em\);/);
  assert.match(short[1],
      /\.arcade-page--pop \.arcade-stage,\s*\.arcade-page--catch \.arcade-stage \{\s*height: calc\(min\(42vh, 22em\) \+ 20px\);/);
  assert.doesNotMatch(short[1], /arcade-page--(?:drag|zap|combo)/);
  assert.match(shorter[1], /height: min\(38vh, 18em\);/);
  assert.match(shorter[1],
      /\.arcade-page--pop \.arcade-stage,\s*\.arcade-page--catch \.arcade-stage \{\s*height: calc\(min\(38vh, 18em\) \+ 20px\);/);
  assert.doesNotMatch(shorter[1], /arcade-page--(?:drag|zap|combo)/);
});

test('Catch falls on a timer and Pop spawns across the stage height', () => {
  const main = read('appengine/arcade/src/main.js');
  // Basket centre stays near the bottom as a fraction of the stage.
  assert.match(main, /placeAt\(basket, basketX, 0\.9\)/);
  // Fall duration is level.fallMs, not a pixel speed.
  assert.match(main, /const progress = \(now - item\.bornAt\) \/ level\.fallMs/);
  assert.match(main, /placeAt\(item\.el, item\.x, progress \* 0\.88\)/);
  // Basket travel is horizontal px/s against the stage width.
  assert.match(main, /\(level\.speed \* dt\) \/ stageWidth/);
  assert.match(main, /spot = randomSpot\(level\.size\)/);
  assert.match(main,
      /const marginY = rect\.height \? Math\.min\(0\.45, \(sizePx \/ 2 \+ 8\) \/ rect\.height\) : 0\.1/);
});

test('the page shell is offline-first', () => {
  const page = read('appengine/arcade.html');
  const home = read('appengine/arcade/src/html.js');
  assert.match(home, /Arcade\.Levels\.totalLevels\(\)/);
  assert.doesNotMatch(home, /Twenty levels/);

  assert.match(page, /arcade\/style\.css/);
  assert.match(page, /common\/boot\.js/);
  assert.doesNotMatch(page, /fonts\.googleapis/);
  assert.doesNotMatch(page, /https?:\/\//);
});

test('arcade uses the shared teacher unlock instead of skipping locks', () => {
  const main = read('appengine/arcade/src/main.js');
  const page = read('appengine/arcade/src/html.js');
  assert.doesNotMatch(main, /SKIP_LEVEL_LOCKS\s*=\s*true/);
  assert.match(main, /goog\.require\('BlocklyDialogs'\)/);
  assert.match(main, /BlocklyGames\.promptTeacherUnlock_/);
  assert.match(main, /ThinkaConfig\.isTeacherPasswordOn\(\)/);
  assert.match(main, /Arcade\.Levels\.isZoneOpen/);
  assert.match(main, /Arcade\.Levels\.levelMayOpen/);
  assert.match(main, /level_locked/);
  assert.match(main, /arcade-zone-card--locked/);
  assert.match(main, /data-level/);
  assert.match(page, /BlocklyGames\.html\.dialog\(\)/);
  assert.doesNotMatch(page, /teacherUnlockPassword/);
  const prompt = main.match(/function promptForLevel_\([\s\S]*?\n\}/);
  assert.ok(prompt, 'promptForLevel_ missing');
  assert.doesNotMatch(prompt[0], /localStorage/);
  assert.doesNotMatch(prompt[0], /saveStars/);
  assert.doesNotMatch(prompt[0], /\+\s*level/);
});

function loadThinka(sandbox) {
  const src = fs.readFileSync(
      path.join(__dirname, '..', 'appengine', 'src', 'thinka.config.js'),
      'utf8');
  vm.runInContext(src, sandbox);
  return sandbox.ThinkaConfig;
}

test('zones stay locked in order until the previous one is finished', () => {
  loadThinka(sandbox);
  const none = function() {
    return {total: 6, done: 0};
  };
  const noUnlock = function() {
    return false;
  };
  assert.strictEqual(Levels.isZoneOpen(0, none, noUnlock, true), true);
  assert.strictEqual(Levels.isZoneOpen(1, none, noUnlock, true), false);
  assert.strictEqual(Levels.isZoneOpen(2, none, noUnlock, true), false);
  const popDone = function(name) {
    return {total: 6, done: name === 'arcade_pop' ? 6 : 0};
  };
  assert.strictEqual(Levels.isZoneOpen(1, popDone, noUnlock, true), true);
  assert.strictEqual(Levels.isZoneOpen(2, popDone, noUnlock, true), false);
  const half = function(name) {
    return {total: 6, done: name === 'arcade_pop' ? 5 : 0};
  };
  assert.strictEqual(Levels.isZoneOpen(1, half, noUnlock, true), false);
});

test('a teacher unlock opens that arcade level and does not finish it', () => {
  loadThinka(sandbox);
  const saved = function() {
    return false;
  };
  const unlock2 = function(level) {
    return level === 2;
  };
  assert.strictEqual(Levels.levelMayOpen(2, true, true, saved, saved), false);
  assert.strictEqual(Levels.levelMayOpen(2, true, true, saved, unlock2), true);
  assert.strictEqual(Levels.levelMayOpen(3, true, true, saved, unlock2), false);
  assert.strictEqual(Levels.levelMayOpen(1, false, true, saved, saved), false);
  assert.strictEqual(
      Levels.levelMayOpen(1, false, true, saved, function(level) {
        return level === 1;
      }), true);
});

test('removing the classroom password opens every arcade zone and level', () => {
  loadThinka(sandbox);
  const none = function() {
    return {total: 6, done: 0};
  };
  const no = function() {
    return false;
  };
  for (let i = 0; i < Levels.ZONE_IDS.length; i++) {
    assert.strictEqual(Levels.isZoneOpen(i, none, no, false), true, 'zone ' + i);
  }
  assert.strictEqual(Levels.levelMayOpen(6, false, false, no, no), true);
  assert.strictEqual(Levels.levelMayOpen(2, false, true, no, no), false);
});

console.log('\n' + passed + ' tests passed');
