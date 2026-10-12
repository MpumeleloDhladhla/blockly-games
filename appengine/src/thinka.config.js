/**
 * @license
 * Copyright 2026 Thinka
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @fileoverview Classroom config for Thinka's Blockly Games fork.
 *
 * TEACHER_PASSWORD is the built-in password on a fresh browser. Teachers
 * change or remove it on teacher.html; that choice is stored in
 * localStorage on this computer (a salted SHA-256 hash, or an explicit
 * "off" flag). Games read it at runtime, so a password change does not
 * need another build.
 *
 * One password unlocks any locked level in any game. This is a classroom
 * soft gate (kids can still view-source) — not real authentication.
 */
'use strict';

goog.provide('ThinkaConfig');


/**
 * Shared teacher password for every locked level across all games.
 * @type {string}
 */
ThinkaConfig.TEACHER_PASSWORD = 'thinka';

/**
 * localStorage key for the teacher password on this browser.
 * Absent: use TEACHER_PASSWORD. "off": password removed. JSON: custom hash.
 * @type {string}
 */
ThinkaConfig.PASSWORD_STORAGE_KEY = 'thinkaTeacherPassword';

/**
 * Stored when a teacher removes the password. Not a hash.
 * @type {string}
 */
ThinkaConfig.PASSWORD_REMOVED = 'off';

/**
 * localStorage suffix stored next to normal progress keys
 * (e.g. maze5_teacherUnlock). Cleared by the index "Clear data" button.
 * @type {string}
 */
ThinkaConfig.UNLOCK_KEY_SUFFIX = '_teacherUnlock';

/**
 * localStorage suffix for a level's mastery star count.
 * @type {string}
 */
ThinkaConfig.STARS_KEY_SUFFIX = '_stars';

/**
 * localStorage suffix for a maze topic whose picture-book explainer has
 * already been shown (or skipped) on this browser.
 * @type {string}
 */
ThinkaConfig.EXPLAINED_KEY_SUFFIX = '_explained';

/**
 * localStorage key for a teacher-unlocked level.
 * @param {string} name Game storage name (maze, bird, ...).
 * @param {number} level Level number.
 * @returns {string} Storage key.
 */
ThinkaConfig.unlockKey = function(name, level) {
  return name + level + ThinkaConfig.UNLOCK_KEY_SUFFIX;
};

/**
 * localStorage key for a level's mastery star count.
 * @param {string} name Game storage name (maze_g2_repeat, bird, ...).
 * @param {number} level Level number.
 * @returns {string} Storage key.
 */
ThinkaConfig.starsKey = function(name, level) {
  return name + level + ThinkaConfig.STARS_KEY_SUFFIX;
};

/**
 * localStorage key for a maze topic whose explainer has been seen.
 * @param {string} name Game storage name (maze_g2_repeat, ...).
 * @returns {string} Storage key.
 */
ThinkaConfig.explainedKey = function(name) {
  return name + ThinkaConfig.EXPLAINED_KEY_SUFFIX;
};

/**
 * localStorage, or null when this page cannot use it.
 * @returns {Storage|null} Storage object.
 * @private
 */
ThinkaConfig.storage_ = function() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch (e) {
    // Firefox can throw SecurityError. Treat that as "no setting saved".
  }
  return null;
};

/**
 * Read one localStorage value.
 * @param {string} key Storage key.
 * @returns {string|undefined} Value, or undefined when missing.
 * @private
 */
ThinkaConfig.storageGet_ = function(key) {
  var storage = ThinkaConfig.storage_();
  if (!storage) {
    return undefined;
  }
  try {
    var value = storage[key];
    return (value === undefined || value === null) ? undefined : String(value);
  } catch (e) {
    return undefined;
  }
};

/**
 * Write one localStorage value.
 * @param {string} key Storage key.
 * @param {string} value Value to store.
 * @returns {boolean} True if the write stuck.
 * @private
 */
ThinkaConfig.storageSet_ = function(key, value) {
  var storage = ThinkaConfig.storage_();
  if (!storage) {
    return false;
  }
  try {
    storage[key] = value;
    return storage[key] === value;
  } catch (e) {
    return false;
  }
};

/**
 * @returns {{mode: string, salt: (string|undefined), hash: (string|undefined)}}
 *     mode is "default", "custom", or "off".
 * @private
 */
ThinkaConfig.readPasswordRecord_ = function() {
  var raw = ThinkaConfig.storageGet_(ThinkaConfig.PASSWORD_STORAGE_KEY);
  if (!raw) {
    return {mode: 'default'};
  }
  if (raw === ThinkaConfig.PASSWORD_REMOVED) {
    return {mode: 'off'};
  }
  try {
    var parsed = JSON.parse(raw);
    // Quoted keys. Closure ADVANCED renames bare properties, and the
    // settings page writes this JSON from the uncompiled source.
    if (parsed && parsed['v'] === 1 && parsed['salt'] && parsed['hash']) {
      return {
        mode: 'custom',
        salt: String(parsed['salt']),
        hash: String(parsed['hash']),
      };
    }
  } catch (e) {
    // A broken record falls back to the built-in password.
  }
  return {mode: 'default'};
};

/**
 * True when a locked level should ask for a password.
 * A fresh browser is on (built-in password). Off only after a teacher
 * removes it on this computer.
 * @returns {boolean} True if a password is required.
 */
ThinkaConfig.isTeacherPasswordOn = function() {
  return ThinkaConfig.readPasswordRecord_().mode !== 'off';
};

/**
 * Compare entered text to the active teacher password.
 * Leading and trailing spaces are ignored. When the password has been
 * removed, every entry matches so a leftover prompt cannot block a level.
 * @param {string} entered Text from the password field.
 * @returns {boolean} True if the password matches, or if no password is on.
 */
ThinkaConfig.checkTeacherPassword = function(entered) {
  var record = ThinkaConfig.readPasswordRecord_();
  if (record.mode === 'off') {
    return true;
  }
  var text = String(entered == null ? '' : entered).trim();
  if (record.mode === 'default') {
    return text === ThinkaConfig.TEACHER_PASSWORD;
  }
  return ThinkaConfig.sha256Hex_(record.salt + '\n' + text) === record.hash;
};

/**
 * Compare entered text to the shared teacher password.
 * Older call sites use this name. It follows the saved setting.
 * @param {string} entered Text from the password field.
 * @returns {boolean} True if the password matches.
 */
ThinkaConfig.checkPassword = function(entered) {
  return ThinkaConfig.checkTeacherPassword(entered);
};

/**
 * @param {!Array<number>|Uint8Array} bytes Byte values 0-255.
 * @returns {string} Lowercase hex.
 * @private
 */
ThinkaConfig.bytesToHex_ = function(bytes) {
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] & 0xff;
    hex += (b < 16 ? '0' : '') + b.toString(16);
  }
  return hex;
};

/**
 * UTF-8 bytes for a JavaScript string. Matches TextEncoder for SHA-256.
 * @param {string} str Text.
 * @returns {!Array<number>} Bytes.
 * @private
 */
ThinkaConfig.utf8Bytes_ = function(str) {
  var out = [];
  var text = String(str);
  for (var i = 0; i < text.length; i++) {
    var c = text.charCodeAt(i);
    if (c < 0x80) {
      out.push(c);
    } else if (c < 0x800) {
      out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      var c2 = text.charCodeAt(++i);
      var u = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
      out.push(
          0xf0 | (u >> 18),
          0x80 | ((u >> 12) & 0x3f),
          0x80 | ((u >> 6) & 0x3f),
          0x80 | (u & 0x3f));
    } else {
      out.push(
          0xe0 | (c >> 12),
          0x80 | ((c >> 6) & 0x3f),
          0x80 | (c & 0x3f));
    }
  }
  return out;
};

/**
 * SHA-256 of a string, as lowercase hex. Synchronous so unlock dialogs
 * can check a saved hash without waiting on SubtleCrypto.
 * @param {string} str Text.
 * @returns {string} 64 hex characters.
 * @private
 */
ThinkaConfig.sha256Hex_ = function(str) {
  var bytes = ThinkaConfig.utf8Bytes_(str);
  var bitLen = bytes.length * 8;
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) {
    bytes.push(0);
  }
  var hi = Math.floor(bitLen / 0x100000000);
  var lo = bitLen >>> 0;
  bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
  bytes.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

  var k = ThinkaConfig.sha256K_();
  var h0 = 0x6a09e667;
  var h1 = 0xbb67ae85;
  var h2 = 0x3c6ef372;
  var h3 = 0xa54ff53a;
  var h4 = 0x510e527f;
  var h5 = 0x9b05688c;
  var h6 = 0x1f83d9ab;
  var h7 = 0x5be0cd19;
  var w = new Array(64);

  var rotr = function(x, n) {
    return ((x >>> n) | (x << (32 - n))) >>> 0;
  };

  for (var offset = 0; offset < bytes.length; offset += 64) {
    var t;
    for (t = 0; t < 16; t++) {
      var p = offset + t * 4;
      w[t] = ((bytes[p] << 24) | (bytes[p + 1] << 16) |
          (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0;
    }
    for (t = 16; t < 64; t++) {
      var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
      var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
    }
    var a = h0;
    var b = h1;
    var c = h2;
    var d = h3;
    var e = h4;
    var f = h5;
    var g = h6;
    var h = h7;
    for (t = 0; t < 64; t++) {
      var s1b = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      var ch = ((e & f) ^ ((~e) & g)) >>> 0;
      var temp1 = (h + s1b + ch + k[t] + w[t]) >>> 0;
      var s0b = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      var maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      var temp2 = (s0b + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  var words = [h0, h1, h2, h3, h4, h5, h6, h7];
  var hex = '';
  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    for (var shift = 28; shift >= 0; shift -= 4) {
      hex += ((word >>> shift) & 0xf).toString(16);
    }
  }
  return hex;
};

/**
 * SHA-256 round constants.
 * @returns {!Array<number>} Sixty-four constants.
 * @private
 */
ThinkaConfig.sha256K_ = function() {
  if (ThinkaConfig.sha256KCache_) {
    return ThinkaConfig.sha256KCache_;
  }
  ThinkaConfig.sha256KCache_ = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  return ThinkaConfig.sha256KCache_;
};

/**
 * 16 random bytes as hex. Uses crypto.getRandomValues when the browser
 * has it (including file://), otherwise Math.random.
 * @returns {string} 32 hex characters.
 * @private
 */
ThinkaConfig.randomSalt_ = function() {
  var cryptoObj = null;
  try {
    if (typeof window !== 'undefined') {
      cryptoObj = window.crypto || window['msCrypto'] || null;
    }
  } catch (e) {
    cryptoObj = null;
  }
  if (cryptoObj && cryptoObj['getRandomValues']) {
    try {
      var buf = new Uint8Array(16);
      cryptoObj['getRandomValues'](buf);
      return ThinkaConfig.bytesToHex_(buf);
    } catch (e2) {
      // Fall through to Math.random.
    }
  }
  var bytes = [];
  for (var i = 0; i < 16; i++) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  return ThinkaConfig.bytesToHex_(bytes);
};

/**
 * SHA-256 hex of material. Uses SubtleCrypto when this page has it, and
 * the synchronous JS hash otherwise. The two agree on UTF-8 SHA-256, so
 * games can check with the JS hash even if this page used SubtleCrypto.
 * @param {string} material Salt and password.
 * @param {function(string)} callback Called with lowercase hex.
 * @private
 */
ThinkaConfig.hashSha256_ = function(material, callback) {
  var jsHex = ThinkaConfig.sha256Hex_(material);
  var subtle = null;
  try {
    var cryptoObj = (typeof window !== 'undefined') ? window['crypto'] : null;
    if (cryptoObj && cryptoObj['subtle'] && cryptoObj['subtle']['digest']) {
      subtle = cryptoObj['subtle'];
    }
  } catch (e) {
    subtle = null;
  }
  if (!subtle) {
    callback(jsHex);
    return;
  }
  try {
    var raw = ThinkaConfig.utf8Bytes_(material);
    var buf = new Uint8Array(raw);
    subtle['digest']('SHA-256', buf)['then'](function(out) {
      var hex = ThinkaConfig.bytesToHex_(new Uint8Array(out));
      // Unlock checks use the JS hash. Keep that digest if they ever differ.
      callback(hex === jsHex ? hex : jsHex);
    }, function() {
      callback(jsHex);
    });
  } catch (e2) {
    callback(jsHex);
  }
};

/**
 * Save a new classroom password as a salted hash. Never stores the text.
 * @param {string} password New password.
 * @param {function(boolean)=} callback Called with true if it was saved.
 */
ThinkaConfig.setTeacherPassword = function(password, callback) {
  var trimmed = String(password == null ? '' : password).trim();
  if (!trimmed) {
    if (callback) {
      callback(false);
    }
    return;
  }
  var salt = ThinkaConfig.randomSalt_();
  var material = salt + '\n' + trimmed;
  ThinkaConfig.hashSha256_(material, function(hex) {
    var record = JSON.stringify({'v': 1, 'salt': salt, 'hash': hex});
    var ok = ThinkaConfig.storageSet_(ThinkaConfig.PASSWORD_STORAGE_KEY, record);
    if (callback) {
      callback(!!ok);
    }
  });
};

/**
 * Remove the classroom password on this browser.
 * Locked levels then open with no password prompt.
 * @returns {boolean} True if the flag was saved.
 */
ThinkaConfig.removeTeacherPassword = function() {
  return ThinkaConfig.storageSet_(
      ThinkaConfig.PASSWORD_STORAGE_KEY, ThinkaConfig.PASSWORD_REMOVED);
};

/**
 * Delete student progress stored on this browser. Keeps the password setting.
 * @returns {boolean} True if storage could be updated.
 */
ThinkaConfig.clearStudentProgress = function() {
  var storage = ThinkaConfig.storage_();
  if (!storage || typeof storage.key !== 'function') {
    return false;
  }
  var keep = ThinkaConfig.PASSWORD_STORAGE_KEY;
  var keys = [];
  try {
    var n = storage.length || 0;
    for (var i = 0; i < n; i++) {
      keys.push(storage.key(i));
    }
  } catch (e) {
    return false;
  }
  for (var j = 0; j < keys.length; j++) {
    if (!keys[j] || keys[j] === keep) {
      continue;
    }
    try {
      if (typeof storage.removeItem === 'function') {
        storage.removeItem(keys[j]);
      } else {
        delete storage[keys[j]];
      }
    } catch (e2) {
      // Keep going; one stuck key should not abort the reset.
    }
  }
  return true;
};

/**
 * Whether a level may be played without the password prompt.
 *
 * Level 1 is always open. Later levels open when:
 * - this level already has saved progress, or
 * - the previous level has saved progress (normal sequential unlock), or
 * - a teacher unlocked this specific level with the password.
 *
 * @param {number} level Level number (1-based).
 * @param {function(number): boolean} hasSavedLevel True if that level
 *     has completed-progress data in localStorage.
 * @param {function(number): boolean} hasTeacherUnlock True if a teacher
 *     already unlocked that level on this browser.
 * @returns {boolean} True if the level is playable.
 */
ThinkaConfig.isLevelPlayable = function(level, hasSavedLevel, hasTeacherUnlock) {
  if (level <= 1) {
    return true;
  }
  if (hasSavedLevel(level)) {
    return true;
  }
  if (hasSavedLevel(level - 1)) {
    return true;
  }
  if (hasTeacherUnlock(level)) {
    return true;
  }
  return false;
};

/**
 * Whether a concept unit may be entered.
 *
 * Units run in order, so a unit opens once the one before it is finished.
 * The first unit is always open, and a unit the student has already started
 * stays open.  A teacher unlock on the unit's first level opens it too, which
 * is how a class can jump straight to the topic they are working on.
 *
 * @param {Object} previous The preceding unit's progress summary, or null if
 *     this is the first unit.  Shape: {total, done}.
 * @param {number} startedLevels How many levels of this unit have progress.
 * @param {boolean} hasTeacherUnlock True if a teacher unlocked this unit.
 * @returns {boolean} True if the unit is playable.
 */
ThinkaConfig.isUnitPlayable = function(previous, startedLevels,
    hasTeacherUnlock) {
  if (!previous) {
    return true;
  }
  if (startedLevels > 0 || hasTeacherUnlock) {
    return true;
  }
  return previous.total > 0 && previous.done >= previous.total;
};
