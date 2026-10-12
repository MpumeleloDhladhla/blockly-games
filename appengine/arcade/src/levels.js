/**
 * @license
 * Copyright 2026 Thinka
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Zones and levels for the Arcade skills game.
 *
 * Five zones drill mouse control, keyboard control, or both together.
 * Every zone has four levels that tighten size, speed, count, or timer.
 * Each level declares `par` and `target` scores, which are the two and
 * three star thresholds (see Arcade.Scoring.starsFor).
 */
'use strict';

goog.provide('Arcade.Levels');


/**
 * Zone ids in picker / URL order.
 * @type {!Array<string>}
 */
Arcade.Levels.ZONE_IDS = ['pop', 'drag', 'catch', 'zap', 'combo'];

/**
 * Home-row keys: the friendliest pool for a first keyboard round.
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
        'Let it float away and you lose the point. From level 3 there are ' +
        'red bombs — leave those alone!',
    levels: [
      {
        title: 'Big bubbles',
        hint: 'Nice and big. Move the mouse, then click in the middle.',
        rounds: 12, size: 92, life: 2400, bombs: 0,
        par: 900, target: 1400,
      },
      {
        title: 'Smaller and quicker',
        hint: 'A little smaller now. Aim before you click.',
        rounds: 14, size: 74, life: 1900, bombs: 0,
        par: 1200, target: 1800,
      },
      {
        title: 'Mind the bombs',
        hint: 'Blue bubbles score. Red bombs cost you — do not click them.',
        rounds: 16, size: 62, life: 1600, bombs: 4,
        par: 1400, target: 2100,
      },
      {
        title: 'Sharp shooter',
        hint: 'Tiny and fast. Steady hand wins.',
        rounds: 18, size: 52, life: 1300, bombs: 6,
        par: 1600, target: 2500,
      },
    ],
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
    levels: [
      {
        title: 'Four shapes',
        hint: 'Press, hold, drag, drop. Take your time.',
        rounds: 4, size: 86, slack: 58, time: 45000,
        par: 500, target: 800,
      },
      {
        title: 'Five shapes',
        hint: 'One more shape. Drop it close to the middle.',
        rounds: 5, size: 76, slack: 48, time: 45000,
        par: 650, target: 1000,
      },
      {
        title: 'Smaller slots',
        hint: 'The outlines are tighter now. Aim carefully.',
        rounds: 6, size: 66, slack: 38, time: 40000,
        par: 800, target: 1250,
      },
      {
        title: 'Steady hands',
        hint: 'Smallest shapes, shortest clock. You have got this.',
        rounds: 7, size: 58, slack: 30, time: 38000,
        par: 950, target: 1500,
      },
    ],
  },

  // fallMs: ms for an item to fall from top to bottom.
  // bad: how many of the drops are bad items to dodge.
  // speed: basket movement in px per second.
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
    levels: [
      {
        title: 'First catches',
        hint: 'Left and right arrow keys. Slow and friendly.',
        rounds: 10, fallMs: 3800, bad: 0, speed: 430,
        par: 750, target: 1150,
      },
      {
        title: 'Rocks appear',
        hint: 'Stars are good. Rocks are not — slide out of the way.',
        rounds: 12, fallMs: 3200, bad: 3, speed: 460,
        par: 1000, target: 1500,
      },
      {
        title: 'Falling faster',
        hint: 'Quicker drops. Watch the top of the screen.',
        rounds: 14, fallMs: 2700, bad: 5, speed: 500,
        par: 1200, target: 1850,
      },
      {
        title: 'Rock storm',
        hint: 'Fast and busy. Plan your next move early.',
        rounds: 16, fallMs: 2200, bad: 7, speed: 540,
        par: 1400, target: 2200,
      },
    ],
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
    levels: [
      {
        title: 'Home row',
        hint: 'Rest your fingers on A S D F and J K L.',
        rounds: 10, life: 2800, pool: Arcade.Levels.HOME_KEYS_,
        par: 750, target: 1150,
      },
      {
        title: 'Quicker home row',
        hint: 'Same keys, less time. Do not look down.',
        rounds: 12, life: 2200, pool: Arcade.Levels.HOME_KEYS_,
        par: 1000, target: 1500,
      },
      {
        title: 'Whole alphabet',
        hint: 'Any letter can show up now.',
        rounds: 14, life: 1800, pool: Arcade.Levels.LETTER_KEYS_,
        par: 1200, target: 1850,
      },
      {
        title: 'Letters and numbers',
        hint: 'Numbers join in. Reach up to the top row.',
        rounds: 16, life: 1500, pool: Arcade.Levels.WIDE_KEYS_,
        par: 1400, target: 2200,
      },
    ],
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
    levels: [
      {
        title: 'Click then press',
        hint: 'Mouse first, keyboard second. One at a time.',
        rounds: 8, size: 96, life: 3600, pool: Arcade.Levels.HOME_KEYS_,
        par: 600, target: 950,
      },
      {
        title: 'Keep the rhythm',
        hint: 'Leave one hand on the mouse and one on the keys.',
        rounds: 10, size: 82, life: 3000, pool: Arcade.Levels.HOME_KEYS_,
        par: 800, target: 1250,
      },
      {
        title: 'Any letter',
        hint: 'The letter could be anywhere on the keyboard.',
        rounds: 12, size: 70, life: 2500, pool: Arcade.Levels.LETTER_KEYS_,
        par: 1000, target: 1550,
      },
      {
        title: 'Arcade champion',
        hint: 'The last one. Fast hands, sharp eyes.',
        rounds: 14, size: 60, life: 2100, pool: Arcade.Levels.LETTER_KEYS_,
        par: 1200, target: 1900,
      },
    ],
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
