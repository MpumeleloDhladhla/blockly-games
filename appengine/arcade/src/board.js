/**
 * @license
 * Copyright 2026 Thinka
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Local leaderboard for the Arcade game.
 *
 * Thinka Games is offline-first with no backend, so the class board lives
 * in localStorage on the classroom computer.  Everything here takes the
 * storage object as an argument so it can be unit tested against a plain
 * object.
 *
 * The saved blob is JSON, so every property that round-trips uses quoted
 * keys and bracket access.  Closure's advanced mode renames dotted
 * properties, which would silently break data written by an older build.
 */
'use strict';

goog.provide('Arcade.Board');


/**
 * localStorage key holding the name of the kid at the keyboard.
 * @type {string}
 */
Arcade.Board.PLAYER_KEY = 'arcade_player';

/**
 * localStorage key holding the whole leaderboard.
 * @type {string}
 */
Arcade.Board.SCORES_KEY = 'arcade_scores';

/**
 * How many names each level keeps.
 * @type {number}
 */
Arcade.Board.MAX_PER_LEVEL = 5;

/**
 * Longest name a kid can enter.  Keeps the board readable on a projector.
 * @type {number}
 */
Arcade.Board.MAX_NAME = 12;

/**
 * Tidy a typed name: collapse whitespace, drop control characters, cap
 * the length.  Returns '' when nothing usable is left.
 * @param {string} raw Whatever was typed.
 * @returns {string} Clean name.
 */
Arcade.Board.cleanName = function(raw) {
  let name = String(raw === null || raw === undefined ? '' : raw);
  name = name.replace(/[\u0000-\u001f\u007f]/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();
  if (name.length > Arcade.Board.MAX_NAME) {
    name = name.substring(0, Arcade.Board.MAX_NAME).trim();
  }
  return name;
};

/**
 * Read the whole board.  A missing or corrupt blob reads as empty rather
 * than breaking the game.
 * @param {Object} storage localStorage, or a stand-in.
 * @returns {!Object} Map of level id to array of entries.
 */
Arcade.Board.load = function(storage) {
  let raw;
  try {
    raw = storage ? storage[Arcade.Board.SCORES_KEY] : null;
  } catch (e) {
    // Firefox can throw SecurityError when touching localStorage.
    return {};
  }
  if (!raw) {
    return {};
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return {};
  }
  if (!data || typeof data !== 'object') {
    return {};
  }
  // Drop anything that is not a list of well-formed entries.
  const clean = {};
  for (const levelId in data) {
    const list = data[levelId];
    if (!Array.isArray(list)) {
      continue;
    }
    const entries = [];
    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const name = Arcade.Board.cleanName(entry['name']);
      const score = Number(entry['score']);
      if (!name || !isFinite(score)) {
        continue;
      }
      entries.push({
        'name': name,
        'score': Math.max(0, Math.round(score)),
        'at': Number(entry['at']) || 0,
      });
    }
    if (entries.length) {
      clean[levelId] = Arcade.Board.sort_(entries)
          .slice(0, Arcade.Board.MAX_PER_LEVEL);
    }
  }
  return clean;
};

/**
 * Write the board back.  Quota or security errors are swallowed: losing a
 * high score must never interrupt play.
 * @param {Object} storage localStorage, or a stand-in.
 * @param {!Object} data Board data.
 */
Arcade.Board.save = function(storage, data) {
  if (!storage) {
    return;
  }
  try {
    storage[Arcade.Board.SCORES_KEY] = JSON.stringify(data);
  } catch (e) {
    // Ignore quota / SecurityError.
  }
};

/**
 * Best score first; when two kids tie, whoever got there first is ahead.
 * @param {!Array<!Object>} entries Entries to order.
 * @returns {!Array<!Object>} The same array, sorted.
 * @private
 */
Arcade.Board.sort_ = function(entries) {
  entries.sort(function(a, b) {
    if (b['score'] !== a['score']) {
      return b['score'] - a['score'];
    }
    return (a['at'] || 0) - (b['at'] || 0);
  });
  return entries;
};

/**
 * File a score against a level.
 *
 * Each name holds one slot per level, so a kid replaying a level improves
 * their own entry instead of filling the board with their name.
 *
 * @param {!Object} data Board data (modified in place and returned).
 * @param {string} levelId Level id, e.g. 'pop3'.
 * @param {string} name Player name.
 * @param {number} score Final score.
 * @param {number} at Timestamp in ms.
 * @returns {!Object} Board data.
 */
Arcade.Board.record = function(data, levelId, name, score, at) {
  const clean = Arcade.Board.cleanName(name);
  if (!clean || !levelId) {
    return data;
  }
  const points = Math.max(0, Math.round(Number(score) || 0));
  const list = Array.isArray(data[levelId]) ? data[levelId] : [];
  const key = clean.toLowerCase();
  let existing = null;
  for (let i = 0; i < list.length; i++) {
    if (String(list[i]['name']).toLowerCase() === key) {
      existing = list[i];
      break;
    }
  }
  if (existing) {
    if (points > existing['score']) {
      existing['score'] = points;
      existing['at'] = Number(at) || 0;
    }
    // Always show the latest spelling of the name.
    existing['name'] = clean;
  } else {
    list.push({'name': clean, 'score': points, 'at': Number(at) || 0});
  }
  data[levelId] = Arcade.Board.sort_(list)
      .slice(0, Arcade.Board.MAX_PER_LEVEL);
  return data;
};

/**
 * Ranked entries for one level.
 * @param {!Object} data Board data.
 * @param {string} levelId Level id.
 * @returns {!Array<!Object>} Entries, best first.
 */
Arcade.Board.top = function(data, levelId) {
  const list = data && Array.isArray(data[levelId]) ? data[levelId] : [];
  return Arcade.Board.sort_(list.slice(0));
};

/**
 * Overall table: each kid's best score on every level they have entered,
 * added up.  This is the "arcade champion" ranking.
 * @param {!Object} data Board data.
 * @param {!Array<string>} levelIds Levels to total across.
 * @returns {!Array<!Object>} Records of {name, total, levels}, best first.
 */
Arcade.Board.champions = function(data, levelIds) {
  const byName = {};
  for (let i = 0; i < levelIds.length; i++) {
    const list = Arcade.Board.top(data, levelIds[i]);
    for (let j = 0; j < list.length; j++) {
      const entry = list[j];
      const key = String(entry['name']).toLowerCase();
      if (!byName[key]) {
        byName[key] = {'name': entry['name'], 'total': 0, 'levels': 0};
      }
      byName[key]['total'] += entry['score'];
      byName[key]['levels']++;
    }
  }
  const rows = [];
  for (const key in byName) {
    rows.push(byName[key]);
  }
  rows.sort(function(a, b) {
    if (b['total'] !== a['total']) {
      return b['total'] - a['total'];
    }
    return String(a['name']).localeCompare(String(b['name']));
  });
  return rows;
};

/**
 * Name of the kid currently at the keyboard, or ''.
 * @param {Object} storage localStorage, or a stand-in.
 * @returns {string} Player name.
 */
Arcade.Board.getPlayer = function(storage) {
  let raw;
  try {
    raw = storage ? storage[Arcade.Board.PLAYER_KEY] : '';
  } catch (e) {
    return '';
  }
  return Arcade.Board.cleanName(raw);
};

/**
 * Remember who is playing.
 * @param {Object} storage localStorage, or a stand-in.
 * @param {string} name Player name.
 * @returns {string} The name that was stored.
 */
Arcade.Board.setPlayer = function(storage, name) {
  const clean = Arcade.Board.cleanName(name);
  if (!storage) {
    return clean;
  }
  try {
    if (clean) {
      storage[Arcade.Board.PLAYER_KEY] = clean;
    } else {
      delete storage[Arcade.Board.PLAYER_KEY];
    }
  } catch (e) {
    // Ignore quota / SecurityError.
  }
  return clean;
};
