/**
 * @license
 * Copyright 2026 Thinka
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Round bookkeeping shared by every Arcade zone.
 *
 * The engine owns the counters and the clock; each zone owns its own
 * drawing and input.  Nothing here touches the DOM, and every method
 * accepts an explicit timestamp, so rounds can be unit tested.
 */
'use strict';

goog.provide('Arcade.Engine');

goog.require('Arcade.Scoring');


/**
 * Track one playthrough of one level.
 * @param {!Object} level Level record from Arcade.Levels.
 * @constructor
 */
Arcade.Engine = function(level) {
  /** @type {!Object} */
  this.level = level;
  /** @type {number} Scoring chances in this round. */
  this.rounds = Math.max(1, level.rounds || 1);
  /** @type {number} Chances used so far (hits plus misses). */
  this.resolved = 0;
  /** @type {number} */
  this.hits = 0;
  /** @type {number} */
  this.misses = 0;
  /** @type {number} Points from hits, before penalties and time bonus. */
  this.base = 0;
  /** @type {number} Current run of hits. */
  this.streak = 0;
  /** @type {number} Longest run of hits this round. */
  this.bestStreak = 0;
  /** @type {number} */
  this.startedAt = 0;
  /** @type {boolean} Set by start(); startedAt alone can legitimately be 0. */
  this.started = false;
  /** @type {number} */
  this.endedAt = 0;
  /** @type {boolean} */
  this.ended = false;
  /** @type {number} Whole-round clock in ms. */
  this.budgetMs = Arcade.Engine.budgetMs(level);
};

/**
 * How long the whole round may take.
 *
 * Drag sets an explicit clock.  The reaction zones get the worst case —
 * every chance running its timer out — so a kid who answers quickly
 * banks the leftover seconds as a time bonus.
 *
 * @param {!Object} level Level record.
 * @returns {number} Milliseconds, or 0 when the level has no clock.
 */
Arcade.Engine.budgetMs = function(level) {
  if (!level) {
    return 0;
  }
  if (level.time) {
    return level.time;
  }
  if (level.life) {
    return level.rounds * level.life;
  }
  if (level.fallMs) {
    return level.rounds * level.fallMs;
  }
  return 0;
};

/**
 * Resolve a caller-supplied timestamp.  Written out rather than using `||`
 * so that a timestamp of 0 is honoured, which tests rely on.
 * @param {number=} nowMs Clock override.
 * @returns {number} Milliseconds.
 * @private
 */
Arcade.Engine.now_ = function(nowMs) {
  return nowMs === undefined || nowMs === null ? Date.now() : nowMs;
};

/**
 * Begin the clock.
 * @param {number=} nowMs Clock override.
 */
Arcade.Engine.prototype.start = function(nowMs) {
  this.startedAt = Arcade.Engine.now_(nowMs);
  this.started = true;
  this.endedAt = 0;
};

/**
 * Score a successful hit.
 * @param {number=} nowMs Clock override.
 * @returns {number} Points awarded.
 */
Arcade.Engine.prototype.hit = function(nowMs) {
  if (this.ended) {
    return 0;
  }
  if (!this.started) {
    this.start(nowMs);
  }
  this.streak++;
  this.bestStreak = Math.max(this.bestStreak, this.streak);
  const points = Arcade.Scoring.hitPoints(this.streak);
  this.base += points;
  this.hits++;
  this.resolved++;
  return points;
};

/**
 * Score a miss: a timed-out target, a wrong key, or a bomb.
 * @param {number=} nowMs Clock override.
 */
Arcade.Engine.prototype.miss = function(nowMs) {
  if (this.ended) {
    return;
  }
  if (!this.started) {
    this.start(nowMs);
  }
  this.streak = 0;
  this.misses++;
  this.resolved++;
};

/**
 * A wrong key or a stray click that does not use up a chance.  It still
 * breaks the streak and costs points, but the target stays live.
 * @param {number=} nowMs Clock override.
 */
Arcade.Engine.prototype.penalty = function(nowMs) {
  if (this.ended) {
    return;
  }
  if (!this.started) {
    this.start(nowMs);
  }
  this.streak = 0;
  this.misses++;
};

/**
 * Milliseconds left on the round clock.
 * @param {number=} nowMs Clock override.
 * @returns {number} Milliseconds, or 0 when there is no clock.
 */
Arcade.Engine.prototype.msLeft = function(nowMs) {
  if (!this.budgetMs || !this.started) {
    return this.budgetMs;
  }
  const now = this.ended ? this.endedAt : Arcade.Engine.now_(nowMs);
  return Math.max(0, this.budgetMs - (now - this.startedAt));
};

/**
 * True once the clock has run out.
 * @param {number=} nowMs Clock override.
 * @returns {boolean} True if out of time.
 */
Arcade.Engine.prototype.isTimeUp = function(nowMs) {
  if (!this.budgetMs || !this.started) {
    return false;
  }
  return this.msLeft(nowMs) <= 0;
};

/**
 * True once every chance in the round has been used.
 * @returns {boolean} True if the round is played out.
 */
Arcade.Engine.prototype.isComplete = function() {
  return this.resolved >= this.rounds;
};

/**
 * Stop the clock.
 * @param {number=} nowMs Clock override.
 */
Arcade.Engine.prototype.finish = function(nowMs) {
  if (!this.ended) {
    this.endedAt = Arcade.Engine.now_(nowMs);
    this.ended = true;
  }
};

/**
 * Live or final numbers for the HUD and the result card.
 * @param {number=} nowMs Clock override.
 * @returns {!Object} Stats record.
 */
Arcade.Engine.prototype.stats = function(nowMs) {
  const done = this.isComplete();
  const msLeft = this.msLeft(nowMs);
  const score = Arcade.Scoring.finalScore({
    base: this.base,
    misses: this.misses,
    msLeft: msLeft,
    done: done,
  });
  return {
    hits: this.hits,
    misses: this.misses,
    base: this.base,
    streak: this.streak,
    bestStreak: this.bestStreak,
    resolved: this.resolved,
    rounds: this.rounds,
    msLeft: msLeft,
    budgetMs: this.budgetMs,
    done: done,
    score: score,
    accuracy: Arcade.Scoring.accuracy(this.hits, this.misses),
    progress: this.resolved / this.rounds,
    stars: Arcade.Scoring.starsFor(this.level, score, done),
  };
};
