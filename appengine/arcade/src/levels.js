/**
 * @license
 * Copyright 2026 Thinka
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Zones and levels for the Arcade skills game.
 *
 * Five zones drill mouse control, keyboard control, or both together.
 * Every zone has six levels: two extra ones folded into that game.
 * The first levels are slower than the original openings.  The last
 * levels are slower than the original finales, and longer (more
 * bubbles, drops, or keys, or a longer drag clock).  The numbers live
 * in the named arrays below so a teacher can retune a round without
 * hunting through the level copy.
 *
 * Each level declares `par` and `target` scores, which are the two and
 * three star thresholds (see Arcade.Scoring.starsFor).
 */
'use strict';

goog.provide('Arcade.Levels');

goog.require('ThinkaConfig');


/**
 * Zone ids in picker / URL order.
 * @type {!Array<string>}
 */
Arcade.Levels.ZONE_IDS = ['pop', 'drag', 'catch', 'zap', 'combo'];

/**
 * Levels in each zone.  Two were added to the original four.
 * @type {number}
 */
Arcade.Levels.LEVELS_PER_ZONE = 6;

/**
 * How many levels were inserted in front of the original four.
 * Used when shifting localStorage progress from the first Arcade release.
 * @type {number}
 */
Arcade.Levels.WARMUP_COUNT = 2;

/**
 * Level count of the original curriculum, before the two extra levels.
 * @type {number}
 */
Arcade.Levels.LEGACY_LEVELS = 4;

/**
 * localStorage flag written once progress matches this curriculum.
 * @type {string}
 */
Arcade.Levels.CURRICULUM_KEY = 'arcade_curriculum';

/**
 * Value stored in CURRICULUM_KEY for the six-level zones.
 * @type {string}
 */
Arcade.Levels.CURRICULUM_VERSION = '6';

/**
 * Basket width used when a Catch level does not set its own.
 * Fraction of the stage.  Wider is easier.
 * The original game used 0.16.
 * @type {number}
 */
Arcade.Levels.CATCH_BASKET_DEFAULT = 0.24;

/**
 * Gap before the next Catch drop, as a fraction of that drop's fall time.
 * Higher means the next item waits longer.  The original game used 0.55.
 * @type {number}
 */
Arcade.Levels.CATCH_SPAWN_GAP_DEFAULT = 0.80;

/**
 * Left-hand home keys: the smallest pool, for the first keyboard rounds.
 * @type {string}
 * @private
 */
Arcade.Levels.WARM_KEYS_ = 'asdf';

/**
 * Home-row keys: the friendliest full pool for a first keyboard round.
 * @type {string}
 * @private
 */
Arcade.Levels.HOME_KEYS_ = 'asdfjkl';

/**
 * Letters that sit on the three main rows.
 * @type {string}
 * @private
 */
Arcade.Levels.LETTER_KEYS_ = 'abcdefghijklmnopqrstuvwxyz';

/**
 * Letters plus digits for the last Zap level.
 * @type {string}
 * @private
 */
Arcade.Levels.WIDE_KEYS_ = Arcade.Levels.LETTER_KEYS_ + '0123456789';

/**
 * Pop: bubble diameter in px.  Bigger is easier to click.
 * @type {!Array<number>}
 */
Arcade.Levels.POP_SIZE = [140, 120, 104, 90, 76, 64];

/**
 * Pop: milliseconds before a bubble floats away.  Higher is slower.
 * The last two stay well above the original 1300ms finale.
 * @type {!Array<number>}
 */
Arcade.Levels.POP_LIFE = [5200, 4200, 3400, 2800, 2400, 2100];

/**
 * Pop: scoring chances (good bubbles).  The last two are longer than
 * the original 18-bubble finale.
 * @type {!Array<number>}
 */
Arcade.Levels.POP_ROUNDS = [8, 10, 12, 14, 20, 24];

/**
 * Pop: bomb bubbles mixed into the round.  The opening levels have none.
 * @type {!Array<number>}
 */
Arcade.Levels.POP_BOMBS = [0, 0, 0, 0, 3, 5];

/**
 * Pop: score for two stars.
 * @type {!Array<number>}
 */
Arcade.Levels.POP_PAR = [500, 750, 1000, 1300, 1700, 2100];

/**
 * Pop: score for three stars.
 * @type {!Array<number>}
 */
Arcade.Levels.POP_TARGET = [900, 1200, 1600, 1900, 2500, 3200];

/**
 * Drag: shape size in px.
 * @type {!Array<number>}
 */
Arcade.Levels.DRAG_SIZE = [118, 106, 94, 82, 72, 64];

/**
 * Drag: how close to the slot centre (px) still counts as a drop.
 * The last level stays looser than the original 30px finale.
 * @type {!Array<number>}
 */
Arcade.Levels.DRAG_SLACK = [96, 82, 68, 56, 46, 38];

/**
 * Drag: whole-round clock in ms.  Drag cannot draw more than seven
 * shapes, so the last level gets longer by keeping the clock up.
 * @type {!Array<number>}
 */
Arcade.Levels.DRAG_TIME = [70000, 65000, 60000, 56000, 52000, 64000];

/**
 * Drag: shapes to place.  Never more than the seven shapes the game draws.
 * @type {!Array<number>}
 */
Arcade.Levels.DRAG_ROUNDS = [4, 4, 5, 6, 7, 7];

/**
 * Drag: score for two stars.
 * @type {!Array<number>}
 */
Arcade.Levels.DRAG_PAR = [250, 380, 500, 650, 800, 950];

/**
 * Drag: score for three stars.
 * @type {!Array<number>}
 */
Arcade.Levels.DRAG_TARGET = [450, 500, 680, 900, 1150, 1180];

/**
 * Catch: ms for an item to fall from top to bottom.  Higher is slower.
 * The last two stay slower than the original 2200ms finale.
 * @type {!Array<number>}
 */
Arcade.Levels.CATCH_FALL = [7000, 5800, 4800, 4000, 3400, 3000];

/**
 * Catch: basket speed in px per second.  Lower is easier to steer.
 * The last level stays under the original 540px/s finale.
 * @type {!Array<number>}
 */
Arcade.Levels.CATCH_SPEED = [220, 260, 300, 340, 380, 420];

/**
 * Catch: good items to catch.  The last two are longer than the
 * original 16-drop finale.
 * @type {!Array<number>}
 */
Arcade.Levels.CATCH_ROUNDS = [8, 10, 12, 14, 18, 22];

/**
 * Catch: rocks to dodge.  The opening levels have none.
 * @type {!Array<number>}
 */
Arcade.Levels.CATCH_BAD = [0, 0, 0, 3, 4, 5];

/**
 * Catch: basket width as a fraction of the stage.  Wider is more forgiving.
 * @type {!Array<number>}
 */
Arcade.Levels.CATCH_BASKET = [0.34, 0.30, 0.28, 0.26, 0.24, 0.22];

/**
 * Catch: spawn gap as a fraction of fall time.  Higher means fewer items
 * on screen at once.
 * @type {!Array<number>}
 */
Arcade.Levels.CATCH_GAP = [1.05, 0.95, 0.85, 0.78, 0.70, 0.64];

/**
 * Catch: score for two stars.
 * @type {!Array<number>}
 */
Arcade.Levels.CATCH_PAR = [500, 750, 1000, 1300, 1700, 2100];

/**
 * Catch: score for three stars.
 * @type {!Array<number>}
 */
Arcade.Levels.CATCH_TARGET = [850, 1200, 1600, 2000, 2600, 3200];

/**
 * Zap: ms to press the lit key.  The last two stay slower than the
 * original 1500ms finale.
 * @type {!Array<number>}
 */
Arcade.Levels.ZAP_LIFE = [5200, 4200, 3400, 2800, 2400, 2100];

/**
 * Zap: scoring chances.  The last two are longer than the original
 * 16-key finale.
 * @type {!Array<number>}
 */
Arcade.Levels.ZAP_ROUNDS = [8, 10, 12, 14, 18, 22];

/**
 * Zap: score for two stars.
 * @type {!Array<number>}
 */
Arcade.Levels.ZAP_PAR = [500, 750, 1000, 1300, 1700, 2100];

/**
 * Zap: score for three stars.
 * @type {!Array<number>}
 */
Arcade.Levels.ZAP_TARGET = [850, 1200, 1600, 2000, 2600, 3200];

/**
 * Combo: target diameter in px.
 * @type {!Array<number>}
 */
Arcade.Levels.COMBO_SIZE = [132, 116, 102, 88, 76, 68];

/**
 * Combo: ms to click the target and then press its letter.
 * The last two stay slower than the original 2100ms finale.
 * @type {!Array<number>}
 */
Arcade.Levels.COMBO_LIFE = [6400, 5200, 4200, 3600, 3000, 2700];

/**
 * Combo: scoring chances.  The last two are longer than the original
 * 14-target finale.
 * @type {!Array<number>}
 */
Arcade.Levels.COMBO_ROUNDS = [6, 8, 10, 12, 16, 18];

/**
 * Combo: score for two stars.
 * @type {!Array<number>}
 */
Arcade.Levels.COMBO_PAR = [350, 550, 800, 1050, 1400, 1750];

/**
 * Combo: score for three stars.
 * @type {!Array<number>}
 */
Arcade.Levels.COMBO_TARGET = [600, 900, 1200, 1600, 2100, 2600];


/**
 * Zip parallel tuning arrays into level records.
 * @param {!Array<string>} titles Short names.
 * @param {!Array<string>} hints One line of coaching each.
 * @param {!Object<string, !Array>} fields Named arrays, one value per level.
 * @returns {!Array<!Object>} Level records.
 * @private
 */
Arcade.Levels.rows_ = function(titles, hints, fields) {
  const levels = [];
  for (let i = 0; i < titles.length; i++) {
    const level = {
      title: titles[i],
      hint: hints[i],
    };
    for (const name in fields) {
      level[name] = fields[name][i];
    }
    levels.push(level);
  }
  return levels;
};

/**
 * The five arcade zones.
 *
 * Shared level fields:
 *   title   Short name shown above the playfield.
 *   hint    One line of kid-facing coaching.
 *   rounds  How many scoring chances the round contains.
 *   par     Score that earns two stars.
 *   target  Score that earns three stars.
 *
 * Zone-specific fields are documented on each zone.
 *
 * Each zone also has an `explainer` shown the first time that game is
 * opened.  `goal` is one short line.  `steps` are the real controls:
 * `keys` for keyboard (with the key faces to draw) or `pointer` for
 * mouse and touch.  A step never mentions a control the zone lacks.
 *
 * @type {!Object<string, !Object>}
 */
Arcade.Levels.ZONES = {
  // size: bubble diameter in px.  life: ms before it drifts away.
  // bombs: how many of the spawns are bombs that must not be clicked.
  'pop': {
    id: 'pop',
    storage: 'arcade_pop',
    title: 'Pop',
    kicker: 'Aim',
    input: 'mouse',
    blurb: 'Pop the bubbles before they float away.',
    help: 'Bubbles appear one at a time. Click a bubble to pop it and score. ' +
        'Let it float away and you lose the point. From level 5 there are ' +
        'red bombs — leave those alone!',
    explainer: {
      goal: 'Pop the blue bubbles before they float away.',
      steps: [
        {
          kind: 'pointer',
          text: 'Click or tap a bubble. Leave the red bombs alone.',
        },
      ],
    },
    levels: Arcade.Levels.rows_([
      'Giant bubbles',
      'Big and slow',
      'Big bubbles',
      'A little smaller',
      'Mind the bombs',
      'Long stretch',
    ], [
      'Huge bubbles and lots of time. Click the middle.',
      'Still big and slow. Click before they float away.',
      'Nice and big. Move the mouse, then click in the middle.',
      'A little smaller now. Aim before you click.',
      'Blue bubbles score. Red bombs cost you — do not click them.',
      'Lots of bubbles, and each one stays up a while. Take your time.',
    ], {
      rounds: Arcade.Levels.POP_ROUNDS,
      size: Arcade.Levels.POP_SIZE,
      life: Arcade.Levels.POP_LIFE,
      bombs: Arcade.Levels.POP_BOMBS,
      par: Arcade.Levels.POP_PAR,
      target: Arcade.Levels.POP_TARGET,
    }),
  },

  // size: shape size in px.  slack: how close to the slot centre counts.
  // time: total ms for the whole round.
  'drag': {
    id: 'drag',
    storage: 'arcade_drag',
    title: 'Drag',
    kicker: 'Grab',
    input: 'mouse',
    blurb: 'Drag each shape home before the timer runs out.',
    help: 'Hold the mouse button down on a shape, drag it onto the matching ' +
        'outline, then let go. Drop it in the wrong place and it springs ' +
        'back. Finish before the clock empties.',
    explainer: {
      goal: 'Drag each shape onto its matching outline.',
      steps: [
        {
          kind: 'pointer',
          text: 'Press and hold with the mouse or your finger, then drop the shape on its outline.',
        },
      ],
    },
    levels: Arcade.Levels.rows_([
      'Four giant shapes',
      'Still roomy',
      'Five shapes',
      'Six shapes',
      'Seven shapes',
      'Long haul',
    ], [
      'Big shapes, wide outlines, a long clock. Press, hold, drag, drop.',
      'Same four shapes. The outlines are still generous.',
      'Five shapes now. Take your time.',
      'Six shapes. Drop each one close to the middle.',
      'Seven shapes. The outlines are a little tighter.',
      'Same seven shapes, and a long clock. No rush.',
    ], {
      rounds: Arcade.Levels.DRAG_ROUNDS,
      size: Arcade.Levels.DRAG_SIZE,
      slack: Arcade.Levels.DRAG_SLACK,
      time: Arcade.Levels.DRAG_TIME,
      par: Arcade.Levels.DRAG_PAR,
      target: Arcade.Levels.DRAG_TARGET,
    }),
  },

  // fallMs: ms for an item to fall from top to bottom.
  // bad: how many of the drops are bad items to dodge.
  // speed: basket movement in px per second.
  // basket: width as a fraction of the stage.
  // gap: spawn delay as a fraction of fallMs.
  'catch': {
    id: 'catch',
    storage: 'arcade_catch',
    title: 'Catch',
    kicker: 'Move',
    input: 'keys',
    blurb: 'Arrow keys left and right. Catch the good stuff.',
    help: 'Press the left and right arrow keys to slide the basket. Catch ' +
        'the falling stars. Later on, rocks fall too — let those hit the ' +
        'ground.',
    explainer: {
      goal: 'Catch the falling stars. Let the rocks miss the basket.',
      steps: [
        {
          kind: 'keys',
          keys: ['\u2190', '\u2192'],
          text: 'Use the arrow keys to move the basket and catch.',
        },
      ],
    },
    levels: Arcade.Levels.rows_([
      'Super slow stars',
      'Easy catches',
      'Slow stars',
      'A few rocks',
      'A long sky',
      'Star marathon',
    ], [
      'A wide basket and very slow stars. Left and right arrow keys.',
      'Still no rocks. Watch the top, then slide.',
      'Left and right arrow keys. Slow and friendly.',
      'Stars are good. Rocks are not — slide out of the way.',
      'More stars, still falling slowly. Watch the top.',
      'The long one. Slow stars, and a lot of them.',
    ], {
      rounds: Arcade.Levels.CATCH_ROUNDS,
      fallMs: Arcade.Levels.CATCH_FALL,
      bad: Arcade.Levels.CATCH_BAD,
      speed: Arcade.Levels.CATCH_SPEED,
      basket: Arcade.Levels.CATCH_BASKET,
      gap: Arcade.Levels.CATCH_GAP,
      par: Arcade.Levels.CATCH_PAR,
      target: Arcade.Levels.CATCH_TARGET,
    }),
  },

  // life: ms to press the key.  pool: characters the round draws from.
  'zap': {
    id: 'zap',
    storage: 'arcade_zap',
    title: 'Zap',
    kicker: 'React',
    input: 'keys',
    blurb: 'A key lights up. Press it fast.',
    help: 'One key appears on screen. Press that key before the bar runs ' +
        'out. Wrong keys cost points, so look before you press.',
    explainer: {
      goal: 'Press the letter that lights up before the bar runs out.',
      steps: [
        {
          kind: 'keys',
          keys: ['A'],
          text: 'Look at the letter, then press that key.',
        },
      ],
    },
    levels: Arcade.Levels.rows_([
      'Just A S D F',
      'Slow home row',
      'Home row',
      'Home row again',
      'Whole alphabet',
      'Letters and numbers',
    ], [
      'Only A, S, D and F. Lots of time. Look, then press.',
      'Home row, still slow. Rest your fingers and wait for the letter.',
      'Rest your fingers on A S D F and J K L.',
      'Same keys. You still have time. Do not look down.',
      'Any letter can show up. This round is longer.',
      'Numbers join in. A long round, and each key still waits.',
    ], {
      rounds: Arcade.Levels.ZAP_ROUNDS,
      life: Arcade.Levels.ZAP_LIFE,
      pool: [
        Arcade.Levels.WARM_KEYS_,
        Arcade.Levels.HOME_KEYS_,
        Arcade.Levels.HOME_KEYS_,
        Arcade.Levels.HOME_KEYS_,
        Arcade.Levels.LETTER_KEYS_,
        Arcade.Levels.WIDE_KEYS_,
      ],
      par: Arcade.Levels.ZAP_PAR,
      target: Arcade.Levels.ZAP_TARGET,
    }),
  },

  // size: target diameter in px.  life: ms to click AND press the letter.
  'combo': {
    id: 'combo',
    storage: 'arcade_combo',
    title: 'Combo',
    kicker: 'Both',
    input: 'both',
    blurb: 'Click the target, then press its letter.',
    help: 'Each target has a letter on it. Click the target with the mouse ' +
        'first, then press that letter on the keyboard. Both steps, in ' +
        'order, before the timer runs out.',
    explainer: {
      goal: 'Click the target, then press the letter on it.',
      steps: [
        {
          kind: 'pointer',
          text: 'Click or tap the circle first.',
        },
        {
          kind: 'keys',
          keys: ['A'],
          text: 'Then press the letter you see.',
        },
      ],
    },
    levels: Arcade.Levels.rows_([
      'One big letter',
      'Slow click and press',
      'Click then press',
      'Keep the rhythm',
      'Any letter',
      'The long round',
    ], [
      'A huge target and only A, S, D or F. Mouse first, then the key.',
      'Still slow. Leave one hand on the mouse and one on the keys.',
      'Mouse first, keyboard second. One at a time.',
      'Leave one hand on the mouse and one on the keys.',
      'The letter could be anywhere. More targets this time.',
      'The long one. The targets stay big enough, and you have time.',
    ], {
      rounds: Arcade.Levels.COMBO_ROUNDS,
      size: Arcade.Levels.COMBO_SIZE,
      life: Arcade.Levels.COMBO_LIFE,
      pool: [
        Arcade.Levels.WARM_KEYS_,
        Arcade.Levels.HOME_KEYS_,
        Arcade.Levels.HOME_KEYS_,
        Arcade.Levels.HOME_KEYS_,
        Arcade.Levels.LETTER_KEYS_,
        Arcade.Levels.LETTER_KEYS_,
      ],
      par: Arcade.Levels.COMBO_PAR,
      target: Arcade.Levels.COMBO_TARGET,
    }),
  },
};

/**
 * Zone record for a URL id, or null.
 * @param {string} id Zone id.
 * @returns {Object} Zone, or null.
 */
Arcade.Levels.getZone = function(id) {
  return Arcade.Levels.ZONES[id] || null;
};

/**
 * Level record (1-based), or null.
 * @param {Object} zone Zone record.
 * @param {number} level Level number.
 * @returns {Object} Level, or null.
 */
Arcade.Levels.getLevel = function(zone, level) {
  if (!zone || !zone.levels) {
    return null;
  }
  return zone.levels[level - 1] || null;
};

/**
 * Leaderboard key for one level, e.g. 'pop3'.
 * @param {string} zoneId Zone id.
 * @param {number} level Level number.
 * @returns {string} Level id.
 */
Arcade.Levels.levelId = function(zoneId, level) {
  return zoneId + level;
};

/**
 * Every level id, in picker order.  The champions table walks this list.
 * @returns {!Array<string>} Level ids.
 */
Arcade.Levels.allLevelIds = function() {
  const ids = [];
  for (let i = 0; i < Arcade.Levels.ZONE_IDS.length; i++) {
    const zone = Arcade.Levels.ZONES[Arcade.Levels.ZONE_IDS[i]];
    for (let lv = 1; lv <= zone.levels.length; lv++) {
      ids.push(Arcade.Levels.levelId(zone.id, lv));
    }
  }
  return ids;
};

/**
 * Where Continue goes after a three-star finish.
 * The next level in this zone, then level 1 of the next zone.
 * @param {string} zoneId Current zone.
 * @param {number} level Current level, 1-based.
 * @returns {?{zone: string, level: number}} Next game, or null at the end.
 */
Arcade.Levels.nextGame = function(zoneId, level) {
  const zone = Arcade.Levels.getZone(zoneId);
  if (!zone) {
    return null;
  }
  const current = Math.floor(level) || 0;
  if (current >= 1 && current < zone.levels.length) {
    return {zone: zoneId, level: current + 1};
  }
  const index = Arcade.Levels.ZONE_IDS.indexOf(zoneId);
  if (current === zone.levels.length &&
      index >= 0 && index + 1 < Arcade.Levels.ZONE_IDS.length) {
    return {zone: Arcade.Levels.ZONE_IDS[index + 1], level: 1};
  }
  return null;
};

/**
 * Whether a zone on the Arcade hub may be entered.
 *
 * Zones run in ZONE_IDS order, the same rule as a Maze topic. The first
 * zone is always open. A later zone opens once the one before it is
 * finished, once this zone has any saved progress, or once a teacher
 * unlocked its first level. With the classroom password removed, every
 * zone is open and nothing is written as a teacher unlock.
 *
 * @param {number} index Index in ZONE_IDS.
 * @param {function(string): {total: number, done: number}} progressFn
 *     Progress summary for a zone storage name.
 * @param {function(string): boolean} unlockedFn True if level 1 of that
 *     storage name was opened with the teacher password.
 * @param {boolean} passwordOn False when the classroom password is off.
 * @returns {boolean} True if the zone is open.
 */
Arcade.Levels.isZoneOpen = function(index, progressFn, unlockedFn, passwordOn) {
  if (!passwordOn || index <= 0) {
    return true;
  }
  const id = Arcade.Levels.ZONE_IDS[index];
  const prevId = Arcade.Levels.ZONE_IDS[index - 1];
  const zone = id ? Arcade.Levels.ZONES[id] : null;
  const prev = prevId ? Arcade.Levels.ZONES[prevId] : null;
  if (!zone || !prev) {
    return false;
  }
  const own = progressFn(zone.storage) || {total: 0, done: 0};
  const previous = progressFn(prev.storage) || {total: 0, done: 0};
  return ThinkaConfig.isUnitPlayable(
      previous, own.done || 0, !!unlockedFn(zone.storage));
};

/**
 * Whether one Arcade level may be played without a new password prompt.
 *
 * A removed password opens every level. Otherwise the level opens when
 * it already has saved progress, a teacher unlocked this exact level,
 * or its zone is open and the usual sequential rule says so. A teacher
 * unlock is not saved progress: the next level stays locked, and the
 * hub still counts this one as unfinished.
 *
 * @param {number} level Level number (1-based).
 * @param {boolean} zoneOpen True if the zone itself may be entered.
 * @param {boolean} passwordOn False when the classroom password is off.
 * @param {function(number): boolean} hasSaved True if that level has
 *     completed-progress data.
 * @param {function(number): boolean} hasUnlock True if a teacher unlocked
 *     that exact level.
 * @returns {boolean} True if the level is playable.
 */
Arcade.Levels.levelMayOpen = function(level, zoneOpen, passwordOn, hasSaved,
    hasUnlock) {
  if (!passwordOn) {
    return true;
  }
  if (hasUnlock(level) || hasSaved(level)) {
    return true;
  }
  if (!zoneOpen) {
    return false;
  }
  return ThinkaConfig.isLevelPlayable(level, hasSaved, hasUnlock);
};

/**
 * localStorage names the hub uses to size the Arcade progress bar.
 * @returns {!Array<!Object>} Records of {name, levels}.
 */
Arcade.Levels.storageNames = function() {
  const names = [];
  for (let i = 0; i < Arcade.Levels.ZONE_IDS.length; i++) {
    const zone = Arcade.Levels.ZONES[Arcade.Levels.ZONE_IDS[i]];
    names.push({name: zone.storage, levels: zone.levels.length});
  }
  return names;
};

/**
 * Total playable Arcade levels across every zone.
 * @returns {number} Count.
 */
Arcade.Levels.totalLevels = function() {
  let total = 0;
  const names = Arcade.Levels.storageNames();
  for (let i = 0; i < names.length; i++) {
    total += names[i].levels;
  }
  return total;
};

/**
 * Copy a storage key forward, without clobbering a value already there.
 * @param {Object} storage localStorage, or a stand-in.
 * @param {string} from Source key.
 * @param {string} to Destination key.
 * @private
 */
Arcade.Levels.moveKey_ = function(storage, from, to) {
  if (storage[from] === undefined || storage[from] === null) {
    return;
  }
  if (storage[to] === undefined || storage[to] === null) {
    storage[to] = storage[from];
  }
  delete storage[from];
};

/**
 * True if this save already has a level past the original four.
 * @param {Object} storage localStorage, or a stand-in.
 * @returns {boolean} True if the longer curriculum is already present.
 * @private
 */
Arcade.Levels.hasExtendedProgress_ = function(storage) {
  const shift = Arcade.Levels.WARMUP_COUNT;
  const legacy = Arcade.Levels.LEGACY_LEVELS;
  for (let i = 0; i < Arcade.Levels.ZONE_IDS.length; i++) {
    const id = Arcade.Levels.ZONE_IDS[i];
    const prefix = Arcade.Levels.ZONES[id].storage;
    for (let level = legacy + 1; level <= legacy + shift; level++) {
      if (storage[prefix + level]) {
        return true;
      }
    }
  }
  const raw = storage['arcade_scores'];
  if (!raw) {
    return false;
  }
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') {
      return false;
    }
    for (let i = 0; i < Arcade.Levels.ZONE_IDS.length; i++) {
      const id = Arcade.Levels.ZONE_IDS[i];
      for (let level = legacy + 1; level <= legacy + shift; level++) {
        if (data[id + level]) {
          return true;
        }
      }
    }
  } catch (e) {
    // Unreadable board does not count as the new curriculum.
  }
  return false;
};

/**
 * Shift a four-level save forward by the warm-up count.
 *
 * Snapshots first so two tabs opening the new game together cannot each
 * apply the shift.  If a source key changed before we write, the other
 * tab already moved it and this call leaves the save alone.
 *
 * @param {Object} storage localStorage, or a stand-in.
 * @private
 */
Arcade.Levels.shiftLegacyProgress_ = function(storage) {
  if (Arcade.Levels.hasExtendedProgress_(storage)) {
    return;
  }
  const legacy = Arcade.Levels.LEGACY_LEVELS;
  const shift = Arcade.Levels.WARMUP_COUNT;
  const moves = [];
  for (let i = 0; i < Arcade.Levels.ZONE_IDS.length; i++) {
    const prefix = Arcade.Levels.ZONES[Arcade.Levels.ZONE_IDS[i]].storage;
    for (let level = legacy; level >= 1; level--) {
      const suffixes = ['', '_stars', '_teacherUnlock'];
      for (let s = 0; s < suffixes.length; s++) {
        const from = prefix + level + suffixes[s];
        if (storage[from] === undefined || storage[from] === null) {
          continue;
        }
        moves.push({
          from: from,
          to: prefix + (level + shift) + suffixes[s],
          value: storage[from],
        });
      }
    }
  }
  let scoreSnapshot = null;
  const scoreRaw = storage['arcade_scores'];
  if (scoreRaw) {
    try {
      const data = JSON.parse(scoreRaw);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        scoreSnapshot = {raw: scoreRaw, data: data};
      }
    } catch (e) {
      scoreSnapshot = null;
    }
  }
  if (!moves.length && !scoreSnapshot) {
    return;
  }
  for (let i = 0; i < moves.length; i++) {
    if (storage[moves[i].from] !== moves[i].value) {
      return;
    }
  }
  if (storage[Arcade.Levels.CURRICULUM_KEY]) {
    return;
  }
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (storage[move.to] === undefined || storage[move.to] === null) {
      storage[move.to] = move.value;
    }
  }
  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    if (storage[move.from] === move.value) {
      delete storage[move.from];
    }
  }
  if (!scoreSnapshot || storage['arcade_scores'] !== scoreSnapshot.raw) {
    return;
  }
  const next = {};
  const keys = [];
  for (const key in scoreSnapshot.data) {
    keys.push(key);
  }
  for (let k = 0; k < keys.length; k++) {
    const key = keys[k];
    const match = /^([a-z]+)(\d+)$/.exec(key);
    if (!match || Arcade.Levels.ZONE_IDS.indexOf(match[1]) === -1) {
      next[key] = scoreSnapshot.data[key];
      continue;
    }
    const level = Number(match[2]);
    if (level >= 1 && level <= legacy) {
      next[match[1] + (level + shift)] = scoreSnapshot.data[key];
    } else {
      next[key] = scoreSnapshot.data[key];
    }
  }
  storage['arcade_scores'] = JSON.stringify(next);
};

/**
 * Bring a local save in line with the six-level zones.
 *
 * The first Arcade release stored levels 1–4.  Two levels were added in
 * front of each zone, so those saves move up by two (level 1 becomes
 * level 3) and the hub's done-count stays attached to the rounds the
 * child actually played.  An empty save, or one already marked with
 * CURRICULUM_VERSION,
 * is left in place.  Stars and teacher-unlock keys move with the level.
 *
 * @param {Object} storage localStorage, or a stand-in.
 * @returns {Object} The same storage object.
 */
Arcade.Levels.migrateStorage = function(storage) {
  if (!storage) {
    return storage;
  }
  let version = '';
  try {
    version = storage[Arcade.Levels.CURRICULUM_KEY] || '';
  } catch (e) {
    return storage;
  }
  if (version === Arcade.Levels.CURRICULUM_VERSION) {
    return storage;
  }
  try {
    if (!version) {
      Arcade.Levels.shiftLegacyProgress_(storage);
    }
    storage[Arcade.Levels.CURRICULUM_KEY] = Arcade.Levels.CURRICULUM_VERSION;
  } catch (e) {
    // SecurityError or quota.  The save stays as it was.
  }
  return storage;
};
