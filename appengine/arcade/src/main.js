/**
 * @license
 * Copyright 2026 Thinka
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Arcade: five mouse and keyboard skill games with scores.
 *
 * Screens are chosen from the URL: no parameters is the home screen,
 * `?champions=1` is the leaderboard, and `?zone=pop&level=2` plays a level.
 *
 * Every zone shares one engine, one HUD, and one animation frame loop.
 * The loop only runs while a round is live, so the menus cost nothing.
 */
'use strict';

goog.provide('Arcade');

goog.require('Arcade.Board');
goog.require('Arcade.Engine');
goog.require('Arcade.Levels');
goog.require('Arcade.Scoring');
goog.require('Arcade.html');
goog.require('BlocklyGames');


/**
 * Zone being played, or null on a menu screen.
 * @type {Object}
 */
Arcade.zone = null;

/**
 * Level record being played, or null.
 * @type {Object}
 */
Arcade.level = null;

/**
 * Round bookkeeping, or null.
 * @type {Arcade.Engine}
 */
Arcade.engine = null;

/**
 * The live zone controller: {setup, update, onKey, teardown}.
 * @type {Object}
 * @private
 */
Arcade.play_ = null;

/**
 * requestAnimationFrame handle, 0 when idle.
 * @type {number}
 * @private
 */
Arcade.raf_ = 0;

/**
 * Overlay button callbacks.
 * @type {Function}
 * @private
 */
Arcade.overlayPrimary_ = null;

/**
 * @type {Function}
 * @private
 */
Arcade.overlaySecondary_ = null;


/**
 * Route to the right screen.
 */
function init() {
  // Arcade is the free-play game: every level is open so a class can all
  // compete on the same one.  Skip the shared sequential-lock pass.
  // Progress and stars still use the shared localStorage keys, and a
  // teacher unlock (ThinkaConfig.TEACHER_PASSWORD) is preserved if one
  // was stored.  Two warm-up levels sit in front of the original four,
  // so older saves are shifted before any screen reads them.
  BlocklyGames.SKIP_LEVEL_LOCKS = true;
  Arcade.Levels.migrateStorage(storage());

  if (BlocklyGames.getStringParamFromUrl('champions', '')) {
    initChampions();
    return;
  }
  const zone = Arcade.Levels.getZone(
      BlocklyGames.getStringParamFromUrl('zone', ''));
  if (!zone) {
    initHome();
    return;
  }
  initPlay(zone);
}

/**
 * Home screen: player name and the five zones.
 */
function initHome() {
  BlocklyGames.storageName = 'arcade';
  document.body.innerHTML = Arcade.html.home(
      {lang: BlocklyGames.LANG, html: BlocklyGames.IS_HTML},
      gameTitle(true),
      `<a class="arcade-link" id="arcadeChampionsLink" href="${arcadeUrl({champions: 1})}">Champions</a>`);
  document.body.classList.add('arcade-app');
  BlocklyGames.init(gameTitle(false));
  wireChrome();
  wireHelp(null);
  paintPlayerChip();
  paintZones();
}

/**
 * Champions board.
 */
function initChampions() {
  BlocklyGames.storageName = 'arcade';
  document.body.innerHTML = Arcade.html.champions(
      {lang: BlocklyGames.LANG, html: BlocklyGames.IS_HTML},
      gameTitle(true),
      `<a class="arcade-link" id="arcadeBackLink" href="${arcadeUrl({})}">Games</a>`);
  document.body.classList.add('arcade-app');
  BlocklyGames.init(gameTitle(false));
  wireChrome();
  wireHelp(null);
  paintChampions();
}

/**
 * One playable level.
 * @param {!Object} zone Zone record.
 */
function initPlay(zone) {
  Arcade.zone = zone;
  BlocklyGames.storageName = zone.storage;
  BlocklyGames.setMaxLevel(zone.levels.length);

  const level = Arcade.Levels.getLevel(zone, BlocklyGames.LEVEL);
  if (!level) {
    window.location = arcadeUrl({});
    return;
  }
  Arcade.level = level;

  document.body.innerHTML = Arcade.html.play(
      {
        lang: BlocklyGames.LANG,
        html: BlocklyGames.IS_HTML,
        level: BlocklyGames.LEVEL,
        maxLevel: BlocklyGames.MAX_LEVEL,
      },
      gameTitle(true),
      zone,
      `<a class="arcade-link" id="arcadeBackLink" href="${arcadeUrl({})}">Games</a>`);
  document.body.classList.add('arcade-app', 'arcade-app--' + zone.id);
  BlocklyGames.init(gameTitle(false));
  wireChrome();
  wireHelp(zone);

  text('arcadeKicker', zone.title + ' \u00b7 Level ' + BlocklyGames.LEVEL);
  text('arcadeLevelTitle', level.title);
  text('arcadeHint', level.hint);
  text('arcadeFoot', zone.input === 'mouse' ? 'Mouse game' :
      (zone.input === 'keys' ? 'Keyboard game' : 'Mouse and keyboard game'));

  const top = Arcade.Board.top(Arcade.Board.load(storage()), levelId());
  text('arcadeBest', top.length ? String(top[0]['score']) : '-');

  Arcade.engine = new Arcade.Engine(level);
  paintHud();

  const startButton = BlocklyGames.getElementById('arcadeStartButton');
  if (startButton) {
    BlocklyGames.bindClick(startButton, startRound);
  }
  document.addEventListener('keydown', onDocumentKey, true);
  window.addEventListener('blur', pauseOnBlur);
}

/**
 * Game title from the language pack, with an English fallback.
 * @param {boolean} escape Escape HTML.
 * @returns {string} Title.
 */
function gameTitle(escape) {
  const pack = window['BlocklyGamesMsg'];
  if (pack && pack['Games.arcade']) {
    return BlocklyGames.getMsg('Games.arcade', escape);
  }
  return 'Arcade';
}

/**
 * Build an Arcade URL.
 * @param {!Object} opts Any of zone, level, champions.
 * @returns {string} URL.
 */
function arcadeUrl(opts) {
  const file = BlocklyGames.IS_HTML ? 'arcade.html' : 'arcade';
  let url = file + '?lang=' + BlocklyGames.LANG;
  if (opts.zone) {
    url += '&zone=' + encodeURIComponent(opts.zone);
    url += '&level=' + (opts.level || 1);
  }
  if (opts.champions) {
    url += '&champions=1';
  }
  return url;
}

/**
 * Leaderboard key for the level on screen.
 * @returns {string} Level id.
 */
function levelId() {
  return Arcade.Levels.levelId(Arcade.zone.id, BlocklyGames.LEVEL);
}

/**
 * localStorage, or null when the browser refuses it.
 * @returns {Object} Storage.
 */
function storage() {
  try {
    return window.localStorage || null;
  } catch (e) {
    return null;
  }
}

/**
 * Set an element's text by id.
 * @param {string} id Element id.
 * @param {string} value Text.
 */
function text(id, value) {
  const el = BlocklyGames.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

/**
 * Language menu plus the tablet-friendly viewport.
 */
function wireChrome() {
  const languageMenu = BlocklyGames.getElementById('languageMenu');
  if (languageMenu) {
    languageMenu.addEventListener('change', BlocklyGames.changeLanguage, true);
  }
  // Classroom tablets should be able to zoom, not lock to Blockly's 725px.
  const viewport = document.querySelector('meta[name="viewport"]');
  if (viewport) {
    viewport.setAttribute('content',
        'width=device-width, initial-scale=1.0, user-scalable=yes');
  }
}

/**
 * Help button for the current screen.
 * @param {Object} zone Zone record, or null on a menu.
 */
function wireHelp(zone) {
  const help = BlocklyGames.getElementById('helpButton');
  if (!help) {
    return;
  }
  BlocklyGames.bindClick(help, function() {
    showOverlay({
      title: zone ? zone.title : 'How Arcade works',
      copy: zone ? zone.help :
          'Five games train your mouse and keyboard. Every level gives you ' +
          'a score: hits and streaks add points, misses take them away, and ' +
          'finishing early pays a time bonus. Add your name and your best ' +
          'score goes on the Champions board.',
      primary: 'OK',
    });
  });
}

/**
 * Show who is playing, and let a tap change it.
 */
function paintPlayerChip() {
  const button = BlocklyGames.getElementById('arcadePlayerName');
  if (!button) {
    return;
  }
  const name = Arcade.Board.getPlayer(storage());
  button.textContent = name || 'Tap to add your name';
  button.classList.toggle('is-empty', !name);
  BlocklyGames.bindClick(button, function() {
    askName(name, function(saved) {
      paintPlayerChip();
      if (saved) {
        paintZones();
      }
    });
  });
}

/**
 * Fill the home screen with one card per zone.
 */
function paintZones() {
  const host = BlocklyGames.getElementById('arcadeZones');
  if (!host) {
    return;
  }
  host.textContent = '';
  const board = Arcade.Board.load(storage());
  for (let i = 0; i < Arcade.Levels.ZONE_IDS.length; i++) {
    const zone = Arcade.Levels.ZONES[Arcade.Levels.ZONE_IDS[i]];
    let done = 0;
    let stars = 0;
    let best = 0;
    for (let lv = 1; lv <= zone.levels.length; lv++) {
      if (BlocklyGames.loadFromLocalStorage(zone.storage, lv)) {
        done++;
      }
      stars += BlocklyGames.loadStars(zone.storage, lv);
      const top = Arcade.Board.top(board, Arcade.Levels.levelId(zone.id, lv));
      if (top.length) {
        best = Math.max(best, top[0]['score']);
      }
    }
    const card = document.createElement('a');
    card.className = 'arcade-zone-card arcade-zone-card--' + zone.id;
    card.href = arcadeUrl({zone: zone.id, level: nextLevel(zone)});
    card.innerHTML =
        Arcade.html.zoneIcon(zone.id) +
        '<span class="arcade-zone-kicker">' + BlocklyGames.esc(zone.kicker) +
        '</span>' +
        '<span class="arcade-zone-title">' + BlocklyGames.esc(zone.title) +
        '</span>' +
        '<span class="arcade-zone-blurb">' + BlocklyGames.esc(zone.blurb) +
        '</span>' +
        '<span class="arcade-zone-meta">' +
        '<span class="arcade-zone-progress">' + done + ' / ' +
        zone.levels.length + '</span>' +
        '<span class="arcade-zone-stars">' + stars + ' \u2605</span>' +
        '</span>' +
        '<span class="arcade-zone-best">' +
        (best ? 'Top score ' + best : 'No scores yet') + '</span>' +
        '<span class="arcade-zone-go">Play</span>';
    host.appendChild(card);
  }
}

/**
 * First level of a zone the player has not finished, or 1.
 * @param {!Object} zone Zone record.
 * @returns {number} Level number.
 */
function nextLevel(zone) {
  for (let lv = 1; lv <= zone.levels.length; lv++) {
    if (!BlocklyGames.loadFromLocalStorage(zone.storage, lv)) {
      return lv;
    }
  }
  return 1;
}


// ---------------------------------------------------------------------------
// Round lifecycle
// ---------------------------------------------------------------------------

/**
 * Clear the stage and begin play.
 */
function startRound() {
  const stage = BlocklyGames.getElementById('arcadeStage');
  if (!stage) {
    return;
  }
  stage.textContent = '';
  stage.classList.add('is-live');
  Arcade.engine = new Arcade.Engine(Arcade.level);
  Arcade.play_ = makeController(Arcade.zone.id);
  Arcade.engine.start(Date.now());
  Arcade.play_.setup();
  stage.focus();
  paintHud();
  loop();
}

/**
 * Animation frame pump.  Runs only while a round is live.
 */
function loop() {
  Arcade.raf_ = window.requestAnimationFrame(function() {
    if (!Arcade.engine || Arcade.engine.ended) {
      return;
    }
    const now = Date.now();
    Arcade.play_.update(now);
    paintHud(now);
    if (Arcade.engine.isComplete() || Arcade.engine.isTimeUp(now)) {
      endRound();
      return;
    }
    loop();
  });
}

/**
 * Stop the pump.
 */
function stopLoop() {
  if (Arcade.raf_) {
    window.cancelAnimationFrame(Arcade.raf_);
    Arcade.raf_ = 0;
  }
}

/**
 * Leaving the tab mid-round would rack up misses, so end it cleanly.
 */
function pauseOnBlur() {
  if (Arcade.engine && Arcade.engine.started && !Arcade.engine.ended) {
    endRound();
  }
}

/**
 * Refresh the HUD.
 * @param {number=} nowMs Clock override.
 */
function paintHud(nowMs) {
  if (!Arcade.engine) {
    return;
  }
  const stats = Arcade.engine.stats(nowMs);
  text('arcadeScore', String(stats.score));
  text('arcadeStreak', String(stats.streak));
  text('arcadeLeft', String(Math.max(0, stats.rounds - stats.resolved)));
  const clock = BlocklyGames.getElementById('arcadeClock');
  if (clock) {
    const pct = stats.budgetMs ?
        Math.max(0, Math.min(100, (stats.msLeft / stats.budgetMs) * 100)) : 100;
    clock.style.width = pct + '%';
    clock.classList.toggle('is-low', pct < 25);
  }
}

/**
 * Finish the round: stop everything, save, and show the result.
 */
function endRound() {
  stopLoop();
  if (!Arcade.engine) {
    return;
  }
  Arcade.engine.finish(Date.now());
  if (Arcade.play_) {
    Arcade.play_.teardown();
  }
  const stage = BlocklyGames.getElementById('arcadeStage');
  if (stage) {
    stage.classList.remove('is-live');
  }
  const stats = Arcade.engine.stats();
  paintHud();
  saveProgress(stats);

  const player = Arcade.Board.getPlayer(storage());
  if (stats.score > 0 && !player) {
    askName('', function(saved) {
      if (saved) {
        recordScore(saved, stats.score);
      }
      showResult(stats);
    });
    return;
  }
  if (stats.score > 0 && player) {
    recordScore(player, stats.score);
  }
  showResult(stats);
}

/**
 * Mark the level complete and bank the stars.  A round worth no stars
 * leaves the level open, so the hub keeps showing it as unfinished.
 * @param {!Object} stats Final stats.
 */
function saveProgress(stats) {
  if (!stats.stars) {
    return;
  }
  const store = storage();
  if (store) {
    try {
      store[BlocklyGames.storageName + BlocklyGames.LEVEL] = JSON.stringify({
        'score': stats.score,
        'stars': stats.stars,
        'hits': stats.hits,
      });
    } catch (e) {
      // Ignore quota / SecurityError; the stars below still try.
    }
  }
  BlocklyGames.saveStars(BlocklyGames.storageName, BlocklyGames.LEVEL,
      stats.stars);
}

/**
 * File a score on the class board.
 * @param {string} name Player name.
 * @param {number} score Final score.
 */
function recordScore(name, score) {
  const store = storage();
  const data = Arcade.Board.load(store);
  Arcade.Board.record(data, levelId(), name, score, Date.now());
  Arcade.Board.save(store, data);
}

/**
 * Ask for a name in the overlay.
 * @param {string} current Name to pre-fill.
 * @param {function(string)} callback Called with the saved name, or ''.
 */
function askName(current, callback) {
  showOverlay({
    title: 'Who is playing?',
    copy: 'Type your name so your scores land on the Champions board.',
    form: true,
    formValue: current || '',
    primary: 'Save',
    secondary: 'Not now',
    onPrimary: function() {
      const input = BlocklyGames.getElementById('arcadeNameInput');
      const saved = Arcade.Board.setPlayer(storage(), input ? input.value : '');
      callback(saved);
    },
    onSecondary: function() {
      callback('');
    },
  });
}

/**
 * Result card: stars, score, and the level's top five.
 * @param {!Object} stats Final stats.
 */
function showResult(stats) {
  const nextInZone = BlocklyGames.LEVEL + 1;
  const hasNext = nextInZone <= Arcade.zone.levels.length;
  const mastered = stats.stars >= 3;
  // Three stars opens the next level, or the next zone after the last one.
  const next = mastered ?
      Arcade.Levels.nextGame(Arcade.zone.id, BlocklyGames.LEVEL) : null;
  const again = arcadeUrl({zone: Arcade.zone.id, level: BlocklyGames.LEVEL});
  const home = arcadeUrl({});
  let title;
  if (!stats.done) {
    title = 'Out of time!';
  } else if (mastered) {
    title = 'Perfect run!';
  } else if (stats.stars) {
    title = 'Level clear!';
  } else {
    title = 'Good try!';
  }
  const copy = stats.score + ' points \u00b7 ' + stats.hits + ' of ' +
      stats.rounds + ' \u00b7 ' + Math.round(stats.accuracy) + '% accurate' +
      (stats.bestStreak > 1 ? ' \u00b7 best streak ' + stats.bestStreak : '');

  let primary = 'Play again';
  let go = again;
  if (next) {
    primary = 'Continue';
    go = arcadeUrl(next);
  } else if (hasNext && stats.stars) {
    primary = 'Next level';
    go = arcadeUrl({zone: Arcade.zone.id, level: nextInZone});
  } else if (mastered) {
    primary = 'Games';
    go = home;
  }
  const replaySecondary = mastered && !next;

  showOverlay({
    title: title,
    copy: copy,
    stars: stats.stars,
    board: Arcade.Board.top(Arcade.Board.load(storage()), levelId()),
    primary: primary,
    secondary: replaySecondary ? 'Play again' : 'Games',
    onPrimary: function() {
      window.location = go;
    },
    onSecondary: function() {
      window.location = replaySecondary ? again : home;
    },
  });
}


// ---------------------------------------------------------------------------
// Champions board
// ---------------------------------------------------------------------------

/**
 * Render the overall table and one table per level.
 */
function paintChampions() {
  const data = Arcade.Board.load(storage());
  const overall = BlocklyGames.getElementById('arcadeOverall');
  if (overall) {
    const rows = Arcade.Board.champions(data, Arcade.Levels.allLevelIds());
    overall.textContent = '';
    if (!rows.length) {
      overall.appendChild(emptyNote(
          'No scores yet. Play a level and add your name.'));
    } else {
      overall.appendChild(scoreTable(rows.map(function(row, i) {
        return {
          rank: i + 1,
          name: row['name'],
          score: row['total'],
          note: row['levels'] + (row['levels'] === 1 ? ' level' : ' levels'),
        };
      })));
    }
  }

  const host = BlocklyGames.getElementById('arcadeBoards');
  if (!host) {
    return;
  }
  host.textContent = '';
  for (let i = 0; i < Arcade.Levels.ZONE_IDS.length; i++) {
    const zone = Arcade.Levels.ZONES[Arcade.Levels.ZONE_IDS[i]];
    for (let lv = 1; lv <= zone.levels.length; lv++) {
      const entries = Arcade.Board.top(
          data, Arcade.Levels.levelId(zone.id, lv));
      const card = document.createElement('div');
      card.className = 'arcade-board-card arcade-board-card--' + zone.id;
      const heading = document.createElement('h3');
      heading.className = 'arcade-board-title';
      heading.textContent = zone.title + ' ' + lv;
      const sub = document.createElement('p');
      sub.className = 'arcade-board-sub';
      sub.textContent = zone.levels[lv - 1].title;
      card.appendChild(heading);
      card.appendChild(sub);
      if (!entries.length) {
        card.appendChild(emptyNote('No scores yet.'));
      } else {
        card.appendChild(scoreTable(entries.map(function(entry, n) {
          return {rank: n + 1, name: entry['name'], score: entry['score'],
                  note: ''};
        })));
      }
      host.appendChild(card);
    }
  }
}

/**
 * A short "nothing here yet" line.
 * @param {string} copy Message.
 * @returns {!Element} Paragraph.
 */
function emptyNote(copy) {
  const p = document.createElement('p');
  p.className = 'arcade-board-empty';
  p.textContent = copy;
  return p;
}

/**
 * Build a ranked table.  Names go in through textContent, never HTML.
 * @param {!Array<!Object>} rows Records of {rank, name, score, note}.
 * @returns {!Element} Table.
 */
function scoreTable(rows) {
  const table = document.createElement('table');
  table.className = 'arcade-score-table';
  for (let i = 0; i < rows.length; i++) {
    const tr = document.createElement('tr');
    const rank = document.createElement('td');
    rank.className = 'arcade-score-rank';
    rank.textContent = String(rows[i].rank);
    const name = document.createElement('td');
    name.className = 'arcade-score-name';
    name.textContent = rows[i].name;
    if (rows[i].note) {
      const note = document.createElement('span');
      note.className = 'arcade-score-note';
      note.textContent = rows[i].note;
      name.appendChild(note);
    }
    const score = document.createElement('td');
    score.className = 'arcade-score-points';
    score.textContent = String(rows[i].score);
    tr.appendChild(rank);
    tr.appendChild(name);
    tr.appendChild(score);
    table.appendChild(tr);
  }
  return table;
}


// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

/**
 * Show the shared modal.
 * @param {!Object} opts Overlay options.
 */
function showOverlay(opts) {
  const overlay = BlocklyGames.getElementById('arcadeOverlay');
  const title = BlocklyGames.getElementById('arcadeOverlayTitle');
  const copy = BlocklyGames.getElementById('arcadeOverlayCopy');
  const stars = BlocklyGames.getElementById('arcadeOverlayStars');
  const boardBox = BlocklyGames.getElementById('arcadeOverlayBoard');
  const form = BlocklyGames.getElementById('arcadeNameForm');
  const input = BlocklyGames.getElementById('arcadeNameInput');
  const primary = BlocklyGames.getElementById('arcadeOverlayPrimary');
  const secondary = BlocklyGames.getElementById('arcadeOverlaySecondary');
  if (!overlay || !title || !copy || !primary || !secondary) {
    return;
  }
  title.textContent = opts.title || '';
  copy.textContent = opts.copy || '';

  stars.textContent = '';
  if (opts.stars) {
    for (let i = 1; i <= 3; i++) {
      const star = document.createElement('span');
      star.className = i <= opts.stars ? 'arcade-star is-on' : 'arcade-star';
      star.textContent = '\u2605';
      stars.appendChild(star);
    }
  }

  boardBox.textContent = '';
  if (opts.board && opts.board.length) {
    const heading = document.createElement('p');
    heading.className = 'arcade-board-sub';
    heading.textContent = 'Top scores on this level';
    boardBox.appendChild(heading);
    boardBox.appendChild(scoreTable(opts.board.map(function(entry, i) {
      return {rank: i + 1, name: entry['name'], score: entry['score'],
              note: ''};
    })));
  }

  if (form) {
    form.hidden = !opts.form;
    if (opts.form && input) {
      input.value = opts.formValue || '';
      form.onsubmit = function(e) {
        e.preventDefault();
        primary.click();
      };
    }
  }

  primary.textContent = opts.primary || 'OK';
  if (opts.secondary) {
    secondary.hidden = false;
    secondary.textContent = opts.secondary;
  } else {
    secondary.hidden = true;
  }
  Arcade.overlayPrimary_ = opts.onPrimary || null;
  Arcade.overlaySecondary_ = opts.onSecondary || null;
  primary.onclick = function() {
    hideOverlay();
    if (Arcade.overlayPrimary_) {
      Arcade.overlayPrimary_();
    }
  };
  secondary.onclick = function() {
    hideOverlay();
    if (Arcade.overlaySecondary_) {
      Arcade.overlaySecondary_();
    }
  };
  overlay.hidden = false;
  if (opts.form && input) {
    window.setTimeout(function() {
      input.focus();
      input.select();
    }, 50);
  }
}

/**
 * Hide the overlay.
 */
function hideOverlay() {
  const overlay = BlocklyGames.getElementById('arcadeOverlay');
  if (overlay) {
    overlay.hidden = true;
  }
}

/**
 * True while a modal is covering the playfield.
 * @returns {boolean} True if open.
 */
function overlayOpen() {
  const overlay = BlocklyGames.getElementById('arcadeOverlay');
  return !!(overlay && !overlay.hidden);
}


// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

/**
 * Feed key presses to the live zone.
 * @param {!Event} e Keyboard event.
 */
function onDocumentKey(e) {
  if (overlayOpen()) {
    return;
  }
  const target = e.target;
  if (target && (target.id === 'arcadeNameInput' ||
      target.id === 'languageMenu')) {
    return;
  }
  if (!Arcade.engine || !Arcade.play_ || Arcade.engine.ended) {
    // Space or Enter starts the round from the keyboard.
    if ((e.key === ' ' || e.key === 'Enter') &&
        BlocklyGames.getElementById('arcadeStartButton')) {
      e.preventDefault();
      startRound();
    }
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) {
    return;
  }
  if (Arcade.play_.onKey) {
    Arcade.play_.onKey(e);
  }
}


// ---------------------------------------------------------------------------
// Stage helpers
// ---------------------------------------------------------------------------

/**
 * The playfield element.
 * @returns {Element} Stage.
 */
function stage() {
  return BlocklyGames.getElementById('arcadeStage');
}

/**
 * Add an element to the stage.
 * @param {string} className Class names.
 * @param {string=} tag Tag name, default div.
 * @returns {!Element} The new element.
 */
function addToStage(className, tag) {
  const el = document.createElement(tag || 'div');
  el.className = className;
  stage().appendChild(el);
  return el;
}

/**
 * Place an element by its centre, as a fraction of the stage.
 * @param {!Element} el Element.
 * @param {number} fx Horizontal fraction 0-1.
 * @param {number} fy Vertical fraction 0-1.
 */
function placeAt(el, fx, fy) {
  el.style.left = (fx * 100) + '%';
  el.style.top = (fy * 100) + '%';
}

/**
 * A random centre that keeps an element of this size fully on stage.
 * @param {number} sizePx Element width and height.
 * @returns {!Object} {x, y} fractions.
 */
function randomSpot(sizePx) {
  const rect = stage().getBoundingClientRect();
  const marginX = rect.width ? Math.min(0.45, (sizePx / 2 + 8) / rect.width) : 0.1;
  const marginY = rect.height ? Math.min(0.45, (sizePx / 2 + 8) / rect.height) : 0.1;
  return {
    x: marginX + Math.random() * (1 - marginX * 2),
    y: marginY + Math.random() * (1 - marginY * 2),
  };
}

/**
 * Pick a random character from a pool.
 * @param {string} pool Characters.
 * @returns {string} One character.
 */
function randomKey(pool) {
  return pool.charAt(Math.floor(Math.random() * pool.length));
}

/**
 * Shuffle in place (Fisher-Yates).
 * @param {!Array} list List to shuffle.
 * @returns {!Array} The same list.
 */
function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = list[i];
    list[i] = list[j];
    list[j] = swap;
  }
  return list;
}

/**
 * Briefly flash the stage to show a mistake.
 */
function flashMiss() {
  const el = stage();
  if (!el) {
    return;
  }
  el.classList.add('is-wrong');
  window.setTimeout(function() {
    el.classList.remove('is-wrong');
  }, 170);
}

/**
 * Pop a floating "+points" label where the action happened.
 * @param {number} fx Horizontal fraction.
 * @param {number} fy Vertical fraction.
 * @param {string} label Text.
 * @param {boolean} good True for a hit, false for a miss.
 */
function floatLabel(fx, fy, label, good) {
  const el = addToStage('arcade-float' + (good ? '' : ' arcade-float--bad'));
  el.textContent = label;
  placeAt(el, fx, fy);
  window.setTimeout(function() {
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }, 620);
}


// ---------------------------------------------------------------------------
// Zone controllers
// ---------------------------------------------------------------------------

/**
 * Build the controller for a zone.
 * @param {string} zoneId Zone id.
 * @returns {!Object} Controller.
 */
function makeController(zoneId) {
  switch (zoneId) {
    case 'pop':
      return popController();
    case 'drag':
      return dragController();
    case 'catch':
      return catchController();
    case 'zap':
      return zapController();
    default:
      return comboController();
  }
}

/**
 * Pop: click the bubbles, leave the bombs.
 * @returns {!Object} Controller.
 */
function popController() {
  const level = Arcade.level;
  const engine = Arcade.engine;
  // Good bubbles are the scoring chances; bombs are extra distractors.
  const queue = [];
  for (let i = 0; i < level.rounds; i++) {
    queue.push(false);
  }
  for (let i = 0; i < (level.bombs || 0); i++) {
    queue.push(true);
  }
  shuffle(queue);

  let current = null;
  let isBomb = false;
  let expiresAt = 0;
  let spot = {x: 0.5, y: 0.5};

  function clear() {
    if (current && current.parentNode) {
      current.parentNode.removeChild(current);
    }
    current = null;
  }

  function spawn(now) {
    if (!queue.length) {
      return;
    }
    isBomb = queue.shift();
    spot = randomSpot(level.size);
    current = addToStage(
        'arcade-bubble' + (isBomb ? ' arcade-bubble--bomb' : ''), 'button');
    current.type = 'button';
    current.style.width = level.size + 'px';
    current.style.height = level.size + 'px';
    current.setAttribute('aria-label', isBomb ? 'Bomb, do not click' : 'Bubble');
    placeAt(current, spot.x, spot.y);
    expiresAt = now + level.life;
    current.addEventListener('pointerdown', onPointer);
  }

  function onPointer(e) {
    e.preventDefault();
    if (!current) {
      return;
    }
    const now = Date.now();
    if (isBomb) {
      engine.penalty(now);
      floatLabel(spot.x, spot.y, '-' + Arcade.Scoring.MISS_PENALTY, false);
      flashMiss();
    } else {
      const points = engine.hit(now);
      floatLabel(spot.x, spot.y, '+' + points, true);
    }
    clear();
    if (!engine.isComplete()) {
      spawn(now);
    }
  }

  return {
    setup: function() {
      spawn(Date.now());
    },
    update: function(now) {
      if (!current) {
        if (!engine.isComplete()) {
          spawn(now);
        }
        return;
      }
      if (now >= expiresAt) {
        if (!isBomb) {
          // A bubble that floats away costs a chance.
          engine.miss(now);
          floatLabel(spot.x, spot.y, 'miss', false);
        }
        clear();
        if (!engine.isComplete()) {
          spawn(now);
        }
      }
    },
    teardown: clear,
  };
}

/**
 * Zap: press the key that lights up.
 * @returns {!Object} Controller.
 */
function zapController() {
  const level = Arcade.level;
  const engine = Arcade.engine;
  let key = '';
  let expiresAt = 0;
  let glyph = null;
  let bar = null;

  function spawn(now) {
    key = randomKey(level.pool);
    if (!glyph) {
      glyph = addToStage('arcade-keycap');
      placeAt(glyph, 0.5, 0.44);
      bar = addToStage('arcade-keybar');
      placeAt(bar, 0.5, 0.74);
      const fill = document.createElement('span');
      fill.className = 'arcade-keybar-fill';
      bar.appendChild(fill);
    }
    glyph.textContent = key.toUpperCase();
    glyph.classList.remove('is-hit');
    expiresAt = now + level.life;
  }

  function paintBar(now) {
    if (!bar) {
      return;
    }
    const left = Math.max(0, (expiresAt - now) / level.life);
    bar.firstChild.style.width = (left * 100) + '%';
  }

  return {
    setup: function() {
      spawn(Date.now());
    },
    update: function(now) {
      paintBar(now);
      if (now >= expiresAt) {
        engine.miss(now);
        floatLabel(0.5, 0.3, 'too slow', false);
        flashMiss();
        if (!engine.isComplete()) {
          spawn(now);
        }
      }
    },
    onKey: function(e) {
      if (e.type !== 'keydown' || e.key.length !== 1) {
        return;
      }
      e.preventDefault();
      const now = Date.now();
      if (e.key.toLowerCase() === key) {
        const points = engine.hit(now);
        floatLabel(0.5, 0.3, '+' + points, true);
        if (glyph) {
          glyph.classList.add('is-hit');
        }
        if (!engine.isComplete()) {
          spawn(now);
        }
      } else {
        engine.penalty(now);
        flashMiss();
      }
    },
    teardown: function() {
      glyph = null;
      bar = null;
    },
  };
}

/**
 * Combo: click the target, then press the letter on it.
 * @returns {!Object} Controller.
 */
function comboController() {
  const level = Arcade.level;
  const engine = Arcade.engine;
  let target = null;
  let key = '';
  let clicked = false;
  let expiresAt = 0;
  let spot = {x: 0.5, y: 0.5};

  function clear() {
    if (target && target.parentNode) {
      target.parentNode.removeChild(target);
    }
    target = null;
  }

  function spawn(now) {
    key = randomKey(level.pool);
    clicked = false;
    spot = randomSpot(level.size);
    target = addToStage('arcade-combo', 'button');
    target.type = 'button';
    target.style.width = level.size + 'px';
    target.style.height = level.size + 'px';
    target.textContent = key.toUpperCase();
    target.setAttribute('aria-label', 'Click, then press ' + key);
    placeAt(target, spot.x, spot.y);
    expiresAt = now + level.life;
    target.addEventListener('pointerdown', function(e) {
      e.preventDefault();
      if (!clicked) {
        clicked = true;
        target.classList.add('is-armed');
      }
    });
  }

  return {
    setup: function() {
      spawn(Date.now());
    },
    update: function(now) {
      if (target && now >= expiresAt) {
        engine.miss(now);
        floatLabel(spot.x, spot.y, 'miss', false);
        flashMiss();
        clear();
        if (!engine.isComplete()) {
          spawn(now);
        }
      }
    },
    onKey: function(e) {
      if (e.type !== 'keydown' || e.key.length !== 1 || !target) {
        return;
      }
      e.preventDefault();
      const now = Date.now();
      if (!clicked) {
        // The mouse step comes first.
        engine.penalty(now);
        flashMiss();
        return;
      }
      if (e.key.toLowerCase() === key) {
        const points = engine.hit(now);
        floatLabel(spot.x, spot.y, '+' + points, true);
        clear();
        if (!engine.isComplete()) {
          spawn(now);
        }
      } else {
        engine.penalty(now);
        flashMiss();
      }
    },
    teardown: clear,
  };
}

/**
 * Catch: arrow keys slide the basket under the falling stars.
 * @returns {!Object} Controller.
 */
function catchController() {
  const level = Arcade.level;
  const engine = Arcade.engine;
  // Wider basket and a longer gap are the forgiving knobs.  Each level
  // sets its own; the defaults cover a record that forgot them.
  const basketWidth = level.basket || Arcade.Levels.CATCH_BASKET_DEFAULT;
  const spawnGap = level.gap || Arcade.Levels.CATCH_SPAWN_GAP_DEFAULT;
  let basket = null;
  let basketX = 0.5;
  let left = false;
  let right = false;
  let lastTick = 0;
  let nextSpawnAt = 0;
  // Cached so the frame loop never forces a layout just to move the basket.
  let stageWidth = 0;
  const queue = [];
  for (let i = 0; i < level.rounds; i++) {
    queue.push(false);
  }
  for (let i = 0; i < (level.bad || 0); i++) {
    queue.push(true);
  }
  shuffle(queue);
  const items = [];

  function spawn(now) {
    const bad = queue.shift();
    const el = addToStage('arcade-drop' + (bad ? ' arcade-drop--bad' : ''));
    const x = 0.1 + Math.random() * 0.8;
    placeAt(el, x, 0);
    items.push({el: el, x: x, bad: bad, bornAt: now});
  }

  function onResize() {
    stageWidth = stage().getBoundingClientRect().width;
  }

  function land(item, now) {
    const caught = Math.abs(item.x - basketX) <= basketWidth / 2;
    if (item.bad) {
      if (caught) {
        engine.penalty(now);
        floatLabel(item.x, 0.86, 'ouch', false);
        flashMiss();
      }
    } else if (caught) {
      const points = engine.hit(now);
      floatLabel(item.x, 0.86, '+' + points, true);
    } else {
      engine.miss(now);
      floatLabel(item.x, 0.86, 'miss', false);
    }
    if (item.el.parentNode) {
      item.el.parentNode.removeChild(item.el);
    }
  }

  return {
    setup: function() {
      basket = addToStage('arcade-basket');
      basket.style.width = (basketWidth * 100) + '%';
      placeAt(basket, basketX, 0.9);
      lastTick = Date.now();
      nextSpawnAt = lastTick;
      stageWidth = stage().getBoundingClientRect().width;
      window.addEventListener('resize', onResize);
    },
    update: function(now) {
      const dt = Math.min(0.05, Math.max(0, (now - lastTick) / 1000));
      lastTick = now;

      if (stageWidth && (left !== right)) {
        const step = (level.speed * dt) / stageWidth;
        basketX += left ? -step : step;
        basketX = Math.max(basketWidth / 2,
            Math.min(1 - basketWidth / 2, basketX));
        placeAt(basket, basketX, 0.9);
      }

      if (queue.length && now >= nextSpawnAt) {
        spawn(now);
        nextSpawnAt = now + level.fallMs * spawnGap;
      }

      for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        const progress = (now - item.bornAt) / level.fallMs;
        if (progress >= 1) {
          land(item, now);
          items.splice(i, 1);
        } else {
          placeAt(item.el, item.x, progress * 0.88);
        }
      }
    },
    onKey: function(e) {
      const down = e.type === 'keydown';
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        left = down;
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        right = down;
      }
    },
    teardown: function() {
      left = false;
      right = false;
      window.removeEventListener('resize', onResize);
    },
  };
}

/**
 * Drag: pull each shape onto its outline.
 * @returns {!Object} Controller.
 */
function dragController() {
  const level = Arcade.level;
  const engine = Arcade.engine;
  const SHAPES = ['circle', 'square', 'triangle', 'star', 'diamond', 'heart',
                  'hexagon'];
  const picks = SHAPES.slice(0, level.rounds);
  const slots = [];
  let dragging = null;
  let pointerId = 0;
  let grabDx = 0;
  let grabDy = 0;

  function fraction(e) {
    const rect = stage().getBoundingClientRect();
    return {
      x: rect.width ? (e.clientX - rect.left) / rect.width : 0,
      y: rect.height ? (e.clientY - rect.top) / rect.height : 0,
    };
  }

  function onMove(e) {
    if (!dragging || e.pointerId !== pointerId) {
      return;
    }
    e.preventDefault();
    const at = fraction(e);
    dragging.fx = at.x - grabDx;
    dragging.fy = at.y - grabDy;
    placeAt(dragging.el, dragging.fx, dragging.fy);
  }

  function onUp(e) {
    if (!dragging || e.pointerId !== pointerId) {
      return;
    }
    e.preventDefault();
    const shape = dragging;
    dragging = null;
    shape.el.classList.remove('is-dragging');
    const rect = stage().getBoundingClientRect();
    const slot = slots[shape.index];
    const dx = (shape.fx - slot.fx) * rect.width;
    const dy = (shape.fy - slot.fy) * rect.height;
    const now = Date.now();
    if (Math.sqrt(dx * dx + dy * dy) <= level.slack) {
      shape.placed = true;
      shape.fx = slot.fx;
      shape.fy = slot.fy;
      placeAt(shape.el, shape.fx, shape.fy);
      shape.el.classList.add('is-placed');
      slot.el.classList.add('is-filled');
      const points = engine.hit(now);
      floatLabel(slot.fx, slot.fy, '+' + points, true);
    } else {
      engine.penalty(now);
      flashMiss();
      shape.fx = shape.homeX;
      shape.fy = shape.homeY;
      placeAt(shape.el, shape.fx, shape.fy);
    }
  }

  return {
    setup: function() {
      const count = picks.length;
      // Outlines across the top, shapes across the bottom, both shuffled.
      const slotOrder = shuffle(picks.slice(0));
      for (let i = 0; i < count; i++) {
        const el = addToStage('arcade-slot arcade-shape--' + slotOrder[i]);
        el.style.width = level.size + 'px';
        el.style.height = level.size + 'px';
        const fx = (i + 1) / (count + 1);
        placeAt(el, fx, 0.26);
        slots[picks.indexOf(slotOrder[i])] = {el: el, fx: fx, fy: 0.26};
      }
      const shapeOrder = shuffle(picks.slice(0));
      for (let i = 0; i < count; i++) {
        const name = shapeOrder[i];
        const index = picks.indexOf(name);
        const el = addToStage('arcade-shape arcade-shape--' + name);
        el.style.width = level.size + 'px';
        el.style.height = level.size + 'px';
        const fx = (i + 1) / (count + 1);
        placeAt(el, fx, 0.78);
        const shape = {el: el, index: index, fx: fx, fy: 0.78,
                       homeX: fx, homeY: 0.78, placed: false};
        el.addEventListener('pointerdown', function(e) {
          if (shape.placed || dragging) {
            return;
          }
          e.preventDefault();
          dragging = shape;
          pointerId = e.pointerId;
          const at = fraction(e);
          grabDx = at.x - shape.fx;
          grabDy = at.y - shape.fy;
          el.classList.add('is-dragging');
          if (el.setPointerCapture) {
            el.setPointerCapture(e.pointerId);
          }
        });
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointercancel', onUp);
      }
    },
    update: function() {
      // Drag is entirely pointer driven; the clock is handled by the engine.
    },
    teardown: function() {
      dragging = null;
    },
  };
}

// Arrow keys need keyup as well, so Catch can stop the basket.
document.addEventListener('keyup', function(e) {
  if (Arcade.play_ && Arcade.play_.onKey && Arcade.engine &&
      !Arcade.engine.ended && !overlayOpen()) {
    Arcade.play_.onKey(e);
  }
}, true);

BlocklyGames.callWhenLoaded(init);
