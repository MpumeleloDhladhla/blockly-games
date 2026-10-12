/**
 * @license
 * Copyright 2026 Thinka
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Score and star maths for the Arcade game.
 *
 * Kept free of DOM and storage so the numbers can be unit tested and so
 * every zone scores the same way: a hit is worth a base amount plus a
 * streak bonus, a miss costs points, and finishing early pays a time bonus.
 */
'use strict';

goog.provide('Arcade.Scoring');


/**
 * Points for a single hit before any streak bonus.
 * @type {number}
 */
Arcade.Scoring.HIT_POINTS = 100;

/**
 * Extra points per consecutive hit after the first.
 * @type {number}
 */
Arcade.Scoring.STREAK_STEP = 20;

/**
 * Ceiling on the streak bonus, so one lucky run cannot dwarf the round.
 * @type {number}
 */
Arcade.Scoring.STREAK_CAP = 100;

/**
 * Points lost for a miss (timed out, wrong key, or a bomb).
 * @type {number}
 */
Arcade.Scoring.MISS_PENALTY = 40;

/**
 * Points per whole second left on the clock, paid only on a finished round.
 * @type {number}
 */
Arcade.Scoring.TIME_BONUS = 5;

/**
 * Value of one hit, given the streak it lands in.
 * @param {number} streak Consecutive hits including this one (1 = first).
 * @returns {number} Points.
 */
Arcade.Scoring.hitPoints = function(streak) {
  const run = Math.max(1, Math.floor(streak || 1));
  const bonus = Math.min((run - 1) * Arcade.Scoring.STREAK_STEP,
      Arcade.Scoring.STREAK_CAP);
  return Arcade.Scoring.HIT_POINTS + bonus;
};

/**
 * Final score for a round.  Never negative: a rough round scores zero
 * rather than a discouraging minus number.
 * @param {!Object} stats Round stats: {base, misses, msLeft, done}.
 * @returns {number} Score.
 */
Arcade.Scoring.finalScore = function(stats) {
  const base = stats && stats.base ? stats.base : 0;
  const misses = stats && stats.misses ? stats.misses : 0;
  const msLeft = stats && stats.msLeft ? stats.msLeft : 0;
  let score = base - (misses * Arcade.Scoring.MISS_PENALTY);
  if (stats && stats.done && msLeft > 0) {
    score += Math.floor(msLeft / 1000) * Arcade.Scoring.TIME_BONUS;
  }
  return Math.max(0, Math.round(score));
};

/**
 * Stars for a finished round.
 *
 * A round that ran out of time, or that ended on a zero score because the
 * misses cancelled out the hits, earns nothing.  The level then stays
 * incomplete in the hub, which is the honest result.
 *
 * @param {Object} level Level record with par and target.
 * @param {number} score Final score.
 * @param {boolean} done True if every chance in the round was used.
 * @returns {number} Stars from 0 to 3.
 */
Arcade.Scoring.starsFor = function(level, score, done) {
  if (!done || !level || score <= 0) {
    return 0;
  }
  if (score >= level.target) {
    return 3;
  }
  if (score >= level.par) {
    return 2;
  }
  return 1;
};

/**
 * Hit rate as a percentage, for the result card.
 * @param {number} hits Successful hits.
 * @param {number} misses Missed or wrong attempts.
 * @returns {number} 0 to 100.
 */
Arcade.Scoring.accuracy = function(hits, misses) {
  const attempts = (hits || 0) + (misses || 0);
  if (!attempts) {
    return 100;
  }
  return (hits / attempts) * 100;
};
