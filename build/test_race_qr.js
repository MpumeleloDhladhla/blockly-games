#!/usr/bin/env node
/**
 * The class join QR is generated in the page, with no network.
 * Run: node build/test_race_qr.js
 */
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const qr = require('../appengine/race/qr.js');

const ROOT = path.join(__dirname, '..');
let passed = 0;

function test(name, fn) {
  fn();
  passed++;
  console.log('ok  ' + name);
}

test('a classroom URL encodes to a scannable version-3 matrix', () => {
  const text = 'http://192.168.1.20:8088/race.html';
  const matrix = qr.matrix(text);
  assert.strictEqual(matrix.length, 29);
  // Finders: three 7x7 rings, top-left, top-right, bottom-left.
  assert.strictEqual(matrix[0][0], true);
  assert.strictEqual(matrix[0][6], true);
  assert.strictEqual(matrix[0][7], false);
  assert.strictEqual(matrix[0][28], true);
  assert.strictEqual(matrix[28][0], true);
  const bits = matrix.map((row) => row.map((cell) => cell ? '1' : '0').join('')).join('');
  const digest = crypto.createHash('sha256').update(bits).digest('hex');
  assert.strictEqual(digest,
      '90b3349f5faeaa2575e11cbad5bb52c1ff4a7220543d35b5b388adc51bd0941d');
});

test('the SVG is self-contained', () => {
  const svg = qr.svg('http://10.0.0.8:8091/race.html');
  assert.match(svg, /^<svg /);
  assert.match(svg, /<\/svg>$/);
  assert.doesNotMatch(svg, /http:\/\/10\.0\.0\.8/);
  assert.doesNotMatch(svg, /cdn|unpkg|jsdelivr/i);
});

test('the race page tells teachers to double-click Start Class', () => {
  const client = fs.readFileSync(path.join(ROOT, 'appengine/race/client.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'appengine/race.html'), 'utf8');
  const hub = fs.readFileSync(path.join(ROOT, 'appengine/index.html'), 'utf8');
  assert.match(client, /double-click <strong>Start Class<\/strong>/);
  assert.match(client, /Start Class \(Mac\)/);
  assert.match(client, /Start Class \(Windows\)/);
  assert.match(client, /right-click it, choose <strong>Open<\/strong>/);
  assert.doesNotMatch(client, /python3 serve\.py/);
  assert.match(html, /race\/qr\.js/);
  assert.match(hub, /Double-click Start Class to host/);
});

console.log('\n' + passed + ' tests passed');
