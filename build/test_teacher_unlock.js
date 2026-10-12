#!/usr/bin/env node
/**
 * Unit tests for the shared teacher-password lock rules.
 * Run: python3 is not required; `node build/test_teacher_unlock.js`
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadThinkaConfig() {
  const sandbox = {
    goog: {
      provide: function(name) {
        const parts = name.split('.');
        let obj = sandbox;
        for (const part of parts) {
          obj[part] = obj[part] || {};
          obj = obj[part];
        }
      },
      require: function() {},
    },
  };
  const src = fs.readFileSync(
      path.join(__dirname, '..', 'appengine', 'src', 'thinka.config.js'),
      'utf8');
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox;
}

const sandbox = loadThinkaConfig();
const ThinkaConfig = sandbox.ThinkaConfig;
const crypto = require('crypto');
let passed = 0;

function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}

test('default password is the documented placeholder', () => {
  assert.strictEqual(ThinkaConfig.TEACHER_PASSWORD, 'thinka');
});

test('checkPassword trims and matches', () => {
  assert.strictEqual(ThinkaConfig.checkPassword('thinka'), true);
  assert.strictEqual(ThinkaConfig.checkPassword('  thinka  '), true);
  assert.strictEqual(ThinkaConfig.checkPassword('THINKA'), false);
  assert.strictEqual(ThinkaConfig.checkPassword('wrong'), false);
  assert.strictEqual(ThinkaConfig.checkPassword(''), false);
  assert.strictEqual(ThinkaConfig.checkPassword(null), false);
});

test('unlock keys sit next to progress keys', () => {
  assert.strictEqual(ThinkaConfig.unlockKey('maze', 5), 'maze5_teacherUnlock');
  assert.strictEqual(ThinkaConfig.unlockKey('pond-tutor', 10),
      'pond-tutor10_teacherUnlock');
});

function playable(level, saved, unlocked) {
  const savedSet = new Set(saved);
  const unlockedSet = new Set(unlocked);
  return ThinkaConfig.isLevelPlayable(
      level,
      (lvl) => savedSet.has(lvl),
      (lvl) => unlockedSet.has(lvl));
}

test('level 1 is always playable', () => {
  assert.strictEqual(playable(1, [], []), true);
});

test('level 2 stays locked without progress or password', () => {
  assert.strictEqual(playable(2, [], []), false);
  assert.strictEqual(playable(5, [], []), false);
});

test('completing a level unlocks only the next one', () => {
  assert.strictEqual(playable(2, [1], []), true);
  assert.strictEqual(playable(3, [1], []), false);
  assert.strictEqual(playable(3, [1, 2], []), true);
  assert.strictEqual(playable(5, [1, 2, 3], []), false);
});

test('saved progress on a level keeps it playable', () => {
  assert.strictEqual(playable(5, [5], []), true);
});

test('teacher unlock opens only that target level', () => {
  assert.strictEqual(playable(5, [], [5]), true);
  assert.strictEqual(playable(4, [], [5]), false);
  assert.strictEqual(playable(6, [], [5]), false);
});

test('password unlock plus later completion does not skip further', () => {
  // Teacher opened 5; student finished 5. Level 6 opens; 4 stays locked.
  assert.strictEqual(playable(5, [5], [5]), true);
  assert.strictEqual(playable(6, [5], [5]), true);
  assert.strictEqual(playable(4, [5], [5]), false);
});

test('star keys sit next to progress keys', () => {
  assert.strictEqual(ThinkaConfig.starsKey('maze_g2_repeat', 3),
      'maze_g2_repeat3_stars');
  assert.strictEqual(ThinkaConfig.starsKey('bird', 10), 'bird10_stars');
});

test('explained keys sit next to a unit\'s progress', () => {
  assert.strictEqual(ThinkaConfig.explainedKey('maze_g2_repeat'),
      'maze_g2_repeat_explained');
});

test('the first unit is always playable', () => {
  assert.strictEqual(ThinkaConfig.isUnitPlayable(null, 0, false), true);
});

test('a unit stays locked until the one before it is finished', () => {
  const half = {total: 6, done: 3};
  const whole = {total: 6, done: 6};
  assert.strictEqual(ThinkaConfig.isUnitPlayable(half, 0, false), false);
  assert.strictEqual(ThinkaConfig.isUnitPlayable(whole, 0, false), true);
});

test('a started unit stays open even if the one before it regresses', () => {
  const half = {total: 6, done: 3};
  assert.strictEqual(ThinkaConfig.isUnitPlayable(half, 2, false), true);
});

test('the teacher password opens a locked unit', () => {
  const none = {total: 6, done: 0};
  assert.strictEqual(ThinkaConfig.isUnitPlayable(none, 0, true), true);
});

test('an empty preceding unit does not count as finished', () => {
  assert.strictEqual(ThinkaConfig.isUnitPlayable({total: 0, done: 0}, 0, false),
      false);
});

function nodeSha256(text) {
  return crypto.createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
}

test('sha256 matches the platform digest, including non-ascii', () => {
  for (const sample of ['', 'abc', 'thinka', 'hello', 'pässwörd', 'key 🔑']) {
    assert.strictEqual(ThinkaConfig.sha256Hex_(sample), nodeSha256(sample), sample);
  }
});

function installStorage(initial) {
  const data = Object.assign({}, initial || {});
  const storage = {};
  Object.defineProperty(storage, 'length', {
    get: function() {
      return Object.keys(data).length;
    },
  });
  storage.key = function(i) {
    return Object.keys(data)[i] || null;
  };
  storage.getItem = function(k) {
    return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
  };
  storage.setItem = function(k, v) {
    data[k] = String(v);
  };
  storage.removeItem = function(k) {
    delete data[k];
  };
  const proxy = new Proxy(storage, {
    get: function(target, prop) {
      if (prop === 'length') {
        return target.length;
      }
      if (prop in target) {
        return target[prop];
      }
      return data[prop];
    },
    set: function(target, prop, value) {
      data[prop] = String(value);
      return true;
    },
    deleteProperty: function(target, prop) {
      delete data[prop];
      return true;
    },
  });
  sandbox.window = {localStorage: proxy};
  return data;
}

test('a fresh browser keeps the built-in password on', () => {
  installStorage();
  assert.strictEqual(ThinkaConfig.isTeacherPasswordOn(), true);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('thinka'), true);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('  thinka  '), true);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('nope'), false);
});

test('a custom password is a salted hash, and the old one stops working', () => {
  installStorage();
  let saved = false;
  ThinkaConfig.setTeacherPassword('  classroom  ', function(ok) {
    saved = ok;
  });
  assert.strictEqual(saved, true);
  const raw = sandbox.window.localStorage[ThinkaConfig.PASSWORD_STORAGE_KEY];
  assert.strictEqual(raw.indexOf('classroom'), -1);
  const parsed = JSON.parse(raw);
  assert.strictEqual(parsed.v, 1);
  assert.strictEqual(parsed.hash.length, 64);
  assert.strictEqual(parsed.hash,
      ThinkaConfig.sha256Hex_(parsed.salt + '\n' + 'classroom'));
  assert.strictEqual(ThinkaConfig.isTeacherPasswordOn(), true);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('classroom'), true);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('  classroom  '), true);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('thinka'), false);
  assert.strictEqual(ThinkaConfig.checkPassword('classroom'), true);
});

test('an empty password is not saved', () => {
  installStorage();
  let saved = true;
  ThinkaConfig.setTeacherPassword('   ', function(ok) {
    saved = ok;
  });
  assert.strictEqual(saved, false);
  assert.strictEqual(
      sandbox.window.localStorage[ThinkaConfig.PASSWORD_STORAGE_KEY], undefined);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('thinka'), true);
});

test('reset to default restores thinka after a custom password', () => {
  installStorage();
  ThinkaConfig.setTeacherPassword('classroom', function() {});
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('classroom'), true);
  assert.strictEqual(ThinkaConfig.resetTeacherPassword(), true);
  assert.strictEqual(
      sandbox.window.localStorage[ThinkaConfig.PASSWORD_STORAGE_KEY], undefined);
  assert.strictEqual(ThinkaConfig.isTeacherPasswordOn(), true);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('thinka'), true);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('classroom'), false);
});

test('reset to default restores thinka after the password was removed', () => {
  installStorage();
  assert.strictEqual(ThinkaConfig.removeTeacherPassword(), true);
  assert.strictEqual(ThinkaConfig.isTeacherPasswordOn(), false);
  assert.strictEqual(ThinkaConfig.resetTeacherPassword(), true);
  assert.strictEqual(ThinkaConfig.isTeacherPasswordOn(), true);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('thinka'), true);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword(''), false);
});

test('removing the password turns the lock off, and setting it again works', () => {
  installStorage();
  ThinkaConfig.setTeacherPassword('classroom', function() {});
  assert.strictEqual(ThinkaConfig.removeTeacherPassword(), true);
  assert.strictEqual(
      sandbox.window.localStorage[ThinkaConfig.PASSWORD_STORAGE_KEY], 'off');
  assert.strictEqual(ThinkaConfig.isTeacherPasswordOn(), false);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword(''), true);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('classroom'), true);
  let saved = false;
  ThinkaConfig.setTeacherPassword('again', function(ok) {
    saved = ok;
  });
  assert.strictEqual(saved, true);
  assert.strictEqual(ThinkaConfig.isTeacherPasswordOn(), true);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('again'), true);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('classroom'), false);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('thinka'), false);
});

test('a broken saved record falls back to the built-in password', () => {
  installStorage();
  sandbox.window.localStorage[ThinkaConfig.PASSWORD_STORAGE_KEY] = '{';
  assert.strictEqual(ThinkaConfig.isTeacherPasswordOn(), true);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('thinka'), true);
});

test('resetting student progress keeps the password', () => {
  installStorage();
  ThinkaConfig.setTeacherPassword('again', function() {});
  sandbox.window.localStorage['maze1'] = '<xml/>';
  sandbox.window.localStorage['maze1_stars'] = '3';
  sandbox.window.localStorage['arcade_scores'] = '{}';
  sandbox.window.localStorage['reboot_name'] = 'Asha';
  assert.strictEqual(ThinkaConfig.clearStudentProgress(), true);
  assert.strictEqual(sandbox.window.localStorage['maze1'], undefined);
  assert.strictEqual(sandbox.window.localStorage['maze1_stars'], undefined);
  assert.strictEqual(sandbox.window.localStorage['arcade_scores'], undefined);
  assert.strictEqual(sandbox.window.localStorage['reboot_name'], undefined);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('again'), true);
  assert.notStrictEqual(
      sandbox.window.localStorage[ThinkaConfig.PASSWORD_STORAGE_KEY], undefined);
});

test('every password prompt uses the shared helpers', () => {
  const root = path.join(__dirname, '..');
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  for (const rel of [
    'appengine/src/lib-dialogs.js',
    'appengine/src/lib-games.js',
    'appengine/keys/src/main.js',
  ]) {
    const src = read(rel);
    assert.match(src, /ThinkaConfig\.isTeacherPasswordOn\(\)/, rel);
    assert.match(src, /ThinkaConfig\.checkTeacherPassword\(/, rel);
    assert.doesNotMatch(src, /ThinkaConfig\.checkPassword\(/, rel);
  }
  const maze = read('appengine/maze/src/select.js');
  assert.match(maze, /ThinkaConfig\.isTeacherPasswordOn\(\)/);
  const arcade = read('appengine/arcade/src/main.js');
  const arcadeHtml = read('appengine/arcade/src/html.js');
  const arcadeLevels = read('appengine/arcade/src/levels.js');
  assert.doesNotMatch(arcade, /SKIP_LEVEL_LOCKS\s*=\s*true/);
  assert.match(arcade, /goog\.require\('BlocklyDialogs'\)/);
  assert.match(arcade, /BlocklyGames\.promptTeacherUnlock_/);
  assert.match(arcade, /ThinkaConfig\.isTeacherPasswordOn\(\)/);
  assert.match(arcade, /Arcade\.Levels\.isZoneOpen/);
  assert.match(arcade, /Arcade\.Levels\.levelMayOpen/);
  assert.match(arcadeHtml, /BlocklyGames\.html\.dialog\(\)/);
  assert.doesNotMatch(arcadeHtml, /id="teacherUnlockPassword"/);
  assert.doesNotMatch(arcade, /That password is not correct/);
  assert.match(arcadeLevels, /ThinkaConfig\.isUnitPlayable/);
  assert.match(arcadeLevels, /ThinkaConfig\.isLevelPlayable/);
  const prompt = arcade.match(
      /function promptForLevel_\([\s\S]*?\n\}/);
  assert.ok(prompt, 'promptForLevel_ missing');
  assert.match(prompt[0], /promptTeacherUnlock_/);
  assert.doesNotMatch(prompt[0], /localStorage/);
  assert.doesNotMatch(prompt[0], /saveStars/);
  const games = read('appengine/src/lib-games.js');
  const playable = games.match(
      /BlocklyGames\.isLevelPlayable = function\(name, level\) \{([\s\S]*?)\n\};/);
  assert.ok(playable, 'isLevelPlayable missing');
  assert.match(playable[1], /isTeacherPasswordOn\(\)/);
});

function loadArcadeLevels() {
  const src = fs.readFileSync(
      path.join(__dirname, '..', 'appengine', 'arcade', 'src', 'levels.js'),
      'utf8');
  vm.runInContext(src, sandbox);
  return sandbox.Arcade.Levels;
}

test('arcade zones and levels follow the shared password rules', () => {
  const Levels = loadArcadeLevels();
  const none = function() {
    return {total: 6, done: 0};
  };
  const noUnlock = function() {
    return false;
  };
  assert.strictEqual(Levels.isZoneOpen(0, none, noUnlock, true), true);
  assert.strictEqual(Levels.isZoneOpen(1, none, noUnlock, true), false);
  assert.strictEqual(Levels.isZoneOpen(4, none, noUnlock, false), true);

  const popDone = function(name) {
    return {total: 6, done: name === 'arcade_pop' ? 6 : 0};
  };
  assert.strictEqual(Levels.isZoneOpen(1, popDone, noUnlock, true), true);
  assert.strictEqual(Levels.isZoneOpen(2, popDone, noUnlock, true), false);

  const dragStarted = function(name) {
    return {total: 6, done: name === 'arcade_drag' ? 1 : 0};
  };
  assert.strictEqual(Levels.isZoneOpen(1, dragStarted, noUnlock, true), true);

  const dragUnlocked = function(name) {
    return name === 'arcade_drag';
  };
  assert.strictEqual(Levels.isZoneOpen(1, none, dragUnlocked, true), true);

  const savedNone = function() {
    return false;
  };
  const unlockOnly2 = function(level) {
    return level === 2;
  };
  assert.strictEqual(
      Levels.levelMayOpen(2, true, true, savedNone, savedNone), false);
  assert.strictEqual(
      Levels.levelMayOpen(2, true, true, savedNone, unlockOnly2), true);
  assert.strictEqual(
      Levels.levelMayOpen(3, true, true, savedNone, unlockOnly2), false);
  assert.strictEqual(
      Levels.levelMayOpen(1, false, true, savedNone, savedNone), false);
  assert.strictEqual(
      Levels.levelMayOpen(6, false, false, savedNone, savedNone), true);
});

test('the hub links to teacher settings, and the page is offline', () => {
  const root = path.join(__dirname, '..');
  const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
  const index = read('appengine/index.html');
  assert.match(index, /class="thinka-teacher-link"/);
  assert.match(index, /href="teacher\.html"/);
  assert.doesNotMatch(index, /thinka-card--teacher/);
  const page = read('appengine/teacher.html');
  assert.match(page, /id="teacherPasswordStatus"/);
  assert.match(page, /Password is ON/);
  assert.match(page, /id="removePassword"/);
  assert.match(page, /id="resetProgress"/);
  assert.match(page, /class="danger"/);
  assert.match(page, /src\/thinka\.config\.js/);
  assert.match(page, /this browser on this computer/);
  assert.doesNotMatch(page, /https?:\/\//);
  assert.match(read('build/pack_offline.sh'), /cp appengine\/src\/thinka\.config\.js "\$GAMES\/src\/thinka\.config\.js"/);
  const config = read('appengine/src/thinka.config.js');
  assert.match(config, /parsed\['v'\]/);
  assert.match(config, /parsed\['salt'\]/);
  assert.match(config, /parsed\['hash'\]/);
  const reboot = read('appengine/reboot.html');
  assert.match(reboot, /thinkaTeacherPassword/);
  assert.match(reboot, /=== 'off'/);
  assert.match(reboot, /teacherPasswordRemoved\(\)/);
});

function finish() {
  console.log('\n' + passed + ' tests passed');
}

(async function subtleAgrees() {
  installStorage();
  sandbox.window.crypto = crypto.webcrypto;
  const material = 'salt\nclassroom';
  const fromSubtle = await new Promise(function(resolve) {
    ThinkaConfig.hashSha256_(material, resolve);
  });
  assert.strictEqual(fromSubtle, nodeSha256(material));
  let saved = false;
  await new Promise(function(resolve) {
    ThinkaConfig.setTeacherPassword('classroom', function(ok) {
      saved = ok;
      resolve();
    });
  });
  assert.strictEqual(saved, true);
  const raw = sandbox.window.localStorage[ThinkaConfig.PASSWORD_STORAGE_KEY];
  assert.strictEqual(raw.indexOf('classroom'), -1);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('classroom'), true);
  assert.strictEqual(ThinkaConfig.checkTeacherPassword('thinka'), false);
  passed++;
  console.log('ok  SubtleCrypto SHA-256 matches the JS hash used by games');
  finish();
})().catch(function(err) {
  console.error(err);
  process.exit(1);
});
