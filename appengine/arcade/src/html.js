/**
 * @license
 * Copyright 2026 Thinka
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview HTML for the Arcade game.
 */
'use strict';

goog.provide('Arcade.html');

goog.require('Arcade.Levels');
goog.require('BlocklyGames');
goog.require('BlocklyGames.html');


/**
 * Home screen: who is playing, the five zones, and the champions board.
 * @param {!Object} ij Injected options.
 * @param {string} appName Escaped game title.
 * @param {string} championsHtml Header control linking to the board.
 * @returns {string} HTML.
 */
Arcade.html.home = function(ij, appName, championsHtml) {
  return `
${BlocklyGames.html.headerBar(ij, appName, '', false, true, championsHtml)}
<div class="arcade-page arcade-page--home">
  <div class="arcade-player" id="arcadePlayer">
    <span class="arcade-player-label">Playing as</span>
    <button type="button" class="arcade-player-name" id="arcadePlayerName"></button>
  </div>
  <p class="arcade-intro">Five games. Twenty levels. Beat your friends' scores.</p>
  <div class="arcade-zones" id="arcadeZones"></div>
</div>
${Arcade.html.overlays_()}
`;
};

/**
 * Play screen for one zone and level.
 * @param {!Object} ij Injected options, including level and maxLevel.
 * @param {string} appName Escaped game title.
 * @param {!Object} zone Zone record.
 * @param {string} backHtml Header control returning to the home screen.
 * @returns {string} HTML.
 */
Arcade.html.play = function(ij, appName, zone, backHtml) {
  const suffix = 'zone=' + encodeURIComponent(zone.id);
  return `
${BlocklyGames.html.headerBar(ij, appName, suffix, false, true, backHtml)}
<div class="arcade-page arcade-page--play arcade-page--${BlocklyGames.esc(zone.id)}">
  <div class="arcade-meta">
    <p class="arcade-kicker" id="arcadeKicker"></p>
    <h2 class="arcade-level-title" id="arcadeLevelTitle"></h2>
    <p class="arcade-hint" id="arcadeHint"></p>
  </div>
  <div class="arcade-hud" id="arcadeHud">
    <div class="arcade-stat">
      <span class="arcade-stat-label">Score</span>
      <span class="arcade-stat-value" id="arcadeScore">0</span>
    </div>
    <div class="arcade-stat">
      <span class="arcade-stat-label">Streak</span>
      <span class="arcade-stat-value" id="arcadeStreak">0</span>
    </div>
    <div class="arcade-stat">
      <span class="arcade-stat-label">Left</span>
      <span class="arcade-stat-value" id="arcadeLeft">0</span>
    </div>
    <div class="arcade-stat arcade-stat--best">
      <span class="arcade-stat-label">Best</span>
      <span class="arcade-stat-value" id="arcadeBest">-</span>
    </div>
  </div>
  <div class="arcade-clock" aria-hidden="true">
    <span class="arcade-clock-bar" id="arcadeClock"></span>
  </div>
  <div class="arcade-stage" id="arcadeStage" tabindex="0"
      role="application" aria-label="Playfield">
    <div class="arcade-stage-start" id="arcadeStart">
      <p class="arcade-stage-go" id="arcadeStartCopy">Ready?</p>
      <button type="button" class="primary" id="arcadeStartButton">Start</button>
    </div>
  </div>
  <p class="arcade-foot" id="arcadeFoot"></p>
</div>
${Arcade.html.overlays_()}
`;
};

/**
 * Champions board: a table per level plus the overall ranking.
 * @param {!Object} ij Injected options.
 * @param {string} appName Escaped game title.
 * @param {string} backHtml Header control returning to the home screen.
 * @returns {string} HTML.
 */
Arcade.html.champions = function(ij, appName, backHtml) {
  return `
${BlocklyGames.html.headerBar(ij, appName, '', false, true, backHtml)}
<div class="arcade-page arcade-page--champions">
  <h2 class="arcade-board-heading">Arcade champions</h2>
  <p class="arcade-intro">Best score each player has made on every level, added up.</p>
  <div class="arcade-overall" id="arcadeOverall"></div>
  <h2 class="arcade-board-heading">Top scores per level</h2>
  <div class="arcade-boards" id="arcadeBoards"></div>
</div>
${Arcade.html.overlays_()}
`;
};

/**
 * Shared overlay shell: help, name entry, results, and teacher unlock.
 * @returns {string} HTML.
 * @private
 */
Arcade.html.overlays_ = function() {
  return `
${BlocklyGames.html.dialog()}
<div id="arcadeOverlay" class="arcade-overlay" hidden>
  <div class="arcade-overlay-card" id="arcadeOverlayPanel" role="dialog"
      aria-modal="true" aria-labelledby="arcadeOverlayTitle">
    <h2 class="arcade-overlay-title" id="arcadeOverlayTitle"></h2>
    <div class="arcade-overlay-stars" id="arcadeOverlayStars"></div>
    <p class="arcade-overlay-copy" id="arcadeOverlayCopy"></p>
    <form class="arcade-overlay-form" id="arcadeNameForm" hidden>
      <label for="arcadeNameInput">Your name</label>
      <input id="arcadeNameInput" autocomplete="off" autocorrect="off"
          spellcheck="false" maxlength="12">
    </form>
    <div class="arcade-overlay-board" id="arcadeOverlayBoard"></div>
    <div class="arcade-overlay-actions">
      <button type="button" id="arcadeOverlaySecondary" class="secondary"></button>
      <button type="button" id="arcadeOverlayPrimary" class="primary"></button>
    </div>
  </div>
</div>
`;
};

/**
 * Icon for a zone card.
 * @param {string} zoneId Zone id.
 * @returns {string} SVG markup.
 */
Arcade.html.zoneIcon = function(zoneId) {
  const art = {
    'pop': `
<circle cx="30" cy="30" r="17" fill="#60A5FA"/>
<circle cx="24" cy="24" r="5" fill="#F8FAFC" opacity=".75"/>
<circle cx="60" cy="52" r="12" fill="#C084FC"/>
<path d="M74 20 l6 6 M80 20 l-6 6" stroke="#FACC15" stroke-width="4"
    stroke-linecap="round"/>`,
    'drag': `
<rect x="12" y="14" width="30" height="30" rx="7" fill="#4ADE80"/>
<rect x="46" y="38" width="30" height="30" rx="7" fill="none"
    stroke="#94A3B8" stroke-width="4" stroke-dasharray="6 5"/>
<path d="M44 30 h18 l-5 -5 M62 30 l-5 5" stroke="#FACC15" stroke-width="4"
    stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    'catch': `
<path d="M20 44 h40 l-6 22 h-28 z" fill="#FF4500"/>
<path d="M44 10 l4 9 10 1 -7 7 2 10 -9 -5 -9 5 2 -10 -7 -7 10 -1 z"
    fill="#FACC15"/>`,
    'zap': `
<rect x="16" y="20" width="48" height="40" rx="8" fill="#121F12"
    stroke="#2DD4BF" stroke-width="3"/>
<text x="40" y="49" font-family="monospace" font-size="26" font-weight="700"
    text-anchor="middle" fill="#2DD4BF">A</text>
<path d="M68 14 l-8 16 h9 l-7 14" stroke="#FACC15" stroke-width="4"
    fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    'combo': `
<circle cx="32" cy="32" r="16" fill="#F472B6"/>
<text x="32" y="39" font-family="monospace" font-size="18" font-weight="700"
    text-anchor="middle" fill="#030A03">K</text>
<path d="M50 46 l22 10 -9 3 -3 9 z" fill="#F8FAFC"/>`,
  };
  return `
<svg class="arcade-zone-icon" viewBox="0 0 88 80" width="88" height="80"
    aria-hidden="true">${art[zoneId] || ''}</svg>`;
};
