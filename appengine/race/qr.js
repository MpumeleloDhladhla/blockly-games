/**
 * Offline QR codes for the class join address.
 * Byte mode, error correction M, versions 1–6. No network, no library.
 */
'use strict';

var ThinkaQr = (function() {
  var EXP = [];
  var LOG = [];
  var i;
  var x = 1;
  for (i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (i = 255; i < 512; i++) {
    EXP[i] = EXP[i - 255];
  }

  function mul(a, b) {
    if (!a || !b) {
      return 0;
    }
    return EXP[LOG[a] + LOG[b]];
  }

  // ISO/IEC 18004 Table 9, error correction M. blocks: [count, data codewords].
  var VERSIONS = {
    1: {size: 21, ec: 10, blocks: [[1, 16]], align: []},
    2: {size: 25, ec: 16, blocks: [[1, 28]], align: [6, 18]},
    3: {size: 29, ec: 26, blocks: [[1, 44]], align: [6, 22]},
    4: {size: 33, ec: 18, blocks: [[2, 32]], align: [6, 26]},
    5: {size: 37, ec: 24, blocks: [[2, 43]], align: [6, 30]},
    6: {size: 41, ec: 16, blocks: [[4, 27]], align: [6, 34]}
  };

  function dataCapacity(version) {
    var total = 0;
    var blocks = version.blocks;
    var i;
    for (i = 0; i < blocks.length; i++) {
      total += blocks[i][0] * blocks[i][1];
    }
    return total;
  }

  function encodeData(text, capacity) {
    var bytes = [];
    var bits = [];
    var i;
    var c;
    var maxBits = capacity * 8;
    var term;
    var data = [];
    var pad = 0xEC;
    var value;
    var bit;
    for (i = 0; i < text.length; i++) {
      c = text.charCodeAt(i);
      if (c > 255) {
        throw new Error('Join address has a character the QR code cannot store');
      }
      bytes.push(c);
    }
    function put(val, len) {
      var n;
      for (n = len - 1; n >= 0; n--) {
        bits.push((val >>> n) & 1);
      }
    }
    put(0x4, 4);
    put(bytes.length, 8);
    for (i = 0; i < bytes.length; i++) {
      put(bytes[i], 8);
    }
    term = Math.min(4, maxBits - bits.length);
    for (i = 0; i < term; i++) {
      bits.push(0);
    }
    while (bits.length % 8) {
      bits.push(0);
    }
    for (i = 0; i < bits.length; i += 8) {
      value = 0;
      for (bit = 0; bit < 8; bit++) {
        value = (value << 1) | bits[i + bit];
      }
      data.push(value);
    }
    while (data.length < capacity) {
      data.push(pad);
      pad = pad === 0xEC ? 0x11 : 0xEC;
    }
    return data;
  }

  function rsEncode(data, ecLen) {
    var gen = [1];
    var i;
    var j;
    var next;
    var coef;
    var res;
    for (i = 0; i < ecLen; i++) {
      next = [];
      for (j = 0; j < gen.length + 1; j++) {
        next.push(0);
      }
      for (j = 0; j < gen.length; j++) {
        next[j] ^= gen[j];
        next[j + 1] ^= mul(gen[j], EXP[i]);
      }
      gen = next;
    }
    res = data.slice();
    for (i = 0; i < ecLen; i++) {
      res.push(0);
    }
    for (i = 0; i < data.length; i++) {
      coef = res[i];
      if (!coef) {
        continue;
      }
      for (j = 0; j < gen.length; j++) {
        res[i + j] ^= mul(gen[j], coef);
      }
    }
    return res.slice(data.length);
  }

  function interleave(data, version) {
    var blocks = [];
    var offset = 0;
    var groups = version.blocks;
    var g;
    var i;
    var count;
    var dlen;
    var chunk;
    var maxData = 0;
    var out = [];
    for (g = 0; g < groups.length; g++) {
      count = groups[g][0];
      dlen = groups[g][1];
      for (i = 0; i < count; i++) {
        chunk = data.slice(offset, offset + dlen);
        offset += dlen;
        blocks.push({data: chunk, ec: rsEncode(chunk, version.ec)});
      }
    }
    for (i = 0; i < blocks.length; i++) {
      if (blocks[i].data.length > maxData) {
        maxData = blocks[i].data.length;
      }
    }
    for (i = 0; i < maxData; i++) {
      for (g = 0; g < blocks.length; g++) {
        if (i < blocks[g].data.length) {
          out.push(blocks[g].data[i]);
        }
      }
    }
    for (i = 0; i < version.ec; i++) {
      for (g = 0; g < blocks.length; g++) {
        out.push(blocks[g].ec[i]);
      }
    }
    return out;
  }

  function blank(n) {
    var rows = [];
    var r;
    var c;
    var row;
    for (r = 0; r < n; r++) {
      row = [];
      for (c = 0; c < n; c++) {
        row.push(false);
      }
      rows.push(row);
    }
    return rows;
  }

  function makeMatrix(version, codewords) {
    var n = version.size;
    var dark = blank(n);
    var reserved = blank(n);
    function set(r, c, on) {
      dark[r][c] = !!on;
      reserved[r][c] = true;
    }
    function finder(r0, c0) {
      var r;
      var c;
      var rr;
      var cc;
      var on;
      for (r = -1; r <= 7; r++) {
        for (c = -1; c <= 7; c++) {
          rr = r0 + r;
          cc = c0 + c;
          if (rr < 0 || cc < 0 || rr >= n || cc >= n) {
            continue;
          }
          on = r >= 0 && r <= 6 && c >= 0 && c <= 6 &&
              (r === 0 || r === 6 || c === 0 || c === 6 ||
               (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          set(rr, cc, on);
        }
      }
    }
    var i;
    var a;
    var b;
    var pos;
    var dr;
    var dc;
    var col;
    var upward;
    var row;
    var k;
    var bitIndex = 0;
    finder(0, 0);
    finder(0, n - 7);
    finder(n - 7, 0);
    for (i = 0; i < n; i++) {
      if (!reserved[6][i]) {
        set(6, i, i % 2 === 0);
      }
      if (!reserved[i][6]) {
        set(i, 6, i % 2 === 0);
      }
    }
    pos = version.align;
    for (a = 0; a < pos.length; a++) {
      for (b = 0; b < pos.length; b++) {
        if (reserved[pos[a]][pos[b]]) {
          continue;
        }
        for (dr = -2; dr <= 2; dr++) {
          for (dc = -2; dc <= 2; dc++) {
            set(pos[a] + dr, pos[b] + dc,
                Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
          }
        }
      }
    }
    set(n - 8, 8, true);
    for (i = 0; i < 9; i++) {
      reserved[8][i] = true;
      reserved[i][8] = true;
    }
    for (i = 0; i < 8; i++) {
      reserved[8][n - 1 - i] = true;
      reserved[n - 1 - i][8] = true;
    }
    function nextBit() {
      var byte;
      var bit;
      if (bitIndex >= codewords.length * 8) {
        return 0;
      }
      byte = codewords[bitIndex >> 3];
      bit = (byte >> (7 - (bitIndex & 7))) & 1;
      bitIndex++;
      return bit;
    }
    upward = true;
    for (col = n - 1; col > 0; col -= 2) {
      if (col === 6) {
        col--;
      }
      for (i = 0; i < n; i++) {
        row = upward ? n - 1 - i : i;
        for (k = 0; k < 2; k++) {
          if (reserved[row][col - k]) {
            continue;
          }
          dark[row][col - k] = !!nextBit();
        }
      }
      upward = !upward;
    }
    return {dark: dark, reserved: reserved};
  }

  function formatBits(maskId) {
    // Error level M is 00, so the 5 data bits are just the mask id.
    var data = maskId & 7;
    var bits = data << 10;
    var i;
    for (i = 14; i >= 10; i--) {
      if ((bits >>> i) & 1) {
        bits ^= 0x537 << (i - 10);
      }
    }
    return ((data << 10) | (bits & 0x3ff)) ^ 0x5412;
  }

  function applyFormat(dark, maskId) {
    // Bit 14 sits at (8, 0). Bit 0 sits at (0, 8). The timing column is skipped.
    var bits = formatBits(maskId);
    var n = dark.length;
    var i;
    var voffset = 0;
    var hoffset = 0;
    var vbit;
    var hbit;
    for (i = 0; i < 8; i++) {
      vbit = (bits >>> i) & 1;
      hbit = (bits >>> (14 - i)) & 1;
      if (i === 6) {
        voffset = 1;
        hoffset = 1;
      }
      dark[i + voffset][8] = !!vbit;
      dark[8][i + hoffset] = !!hbit;
      dark[8][n - 1 - i] = !!vbit;
      dark[n - 1 - i][8] = !!hbit;
    }
    dark[n - 8][8] = true;
  }

  var MASKS = [
    function(r, c) { return ((r + c) & 1) === 0; },
    function(r, c) { return (r & 1) === 0; },
    function(r, c) { return c % 3 === 0; },
    function(r, c) { return (r + c) % 3 === 0; },
    function(r, c) { return (((r >> 1) + Math.floor(c / 3)) & 1) === 0; },
    function(r, c) { return ((r * c) % 2) + ((r * c) % 3) === 0; },
    function(r, c) { return ((((r * c) % 2) + ((r * c) % 3)) & 1) === 0; },
    function(r, c) { return ((((r + c) % 2) + ((r * c) % 3)) & 1) === 0; }
  ];

  function penalty(dark) {
    var n = dark.length;
    var score = 0;
    var r;
    var c;
    var col;
    var v;
    var s;
    var w;
    var darkCount = 0;
    var pct;
    function runs(values) {
      var i;
      var length = 1;
      for (i = 1; i < values.length; i++) {
        if (values[i] === values[i - 1]) {
          length++;
        } else {
          if (length >= 5) {
            score += 3 + (length - 5);
          }
          length = 1;
        }
      }
      if (length >= 5) {
        score += 3 + (length - 5);
      }
    }
    function finderLike(values) {
      var text = values.map(function(bit) { return bit ? '1' : '0'; }).join('');
      var i;
      var window;
      for (i = 0; i + 11 <= text.length; i++) {
        window = text.substr(i, 11);
        if (window === '00001011101' || window === '10111010000') {
          score += 40;
        }
      }
    }
    for (r = 0; r < n; r++) {
      runs(dark[r]);
      finderLike(dark[r]);
    }
    for (c = 0; c < n; c++) {
      col = [];
      for (r = 0; r < n; r++) {
        col.push(dark[r][c]);
      }
      runs(col);
      finderLike(col);
    }
    for (r = 0; r < n - 1; r++) {
      for (c = 0; c < n - 1; c++) {
        v = dark[r][c];
        if (v === dark[r][c + 1] && v === dark[r + 1][c] && v === dark[r + 1][c + 1]) {
          score += 3;
        }
      }
    }
    for (r = 0; r < n; r++) {
      for (c = 0; c < n; c++) {
        if (dark[r][c]) {
          darkCount++;
        }
      }
    }
    pct = Math.abs(Math.floor(darkCount * 100 / (n * n)) - 50);
    score += Math.floor(pct / 5) * 10;
    return score;
  }

  function copyGrid(grid) {
    var out = [];
    var r;
    for (r = 0; r < grid.length; r++) {
      out.push(grid[r].slice());
    }
    return out;
  }

  function matrix(text) {
    var versionNo;
    var version = null;
    var capacity;
    var data;
    var codewords;
    var base;
    var mask;
    var best = null;
    var bestScore = 1e15;
    var grid;
    var r;
    var c;
    var score;
    if (!text) {
      throw new Error('Nothing to encode');
    }
    for (versionNo = 1; versionNo <= 6; versionNo++) {
      capacity = dataCapacity(VERSIONS[versionNo]);
      if ((4 + 8 + text.length * 8) <= capacity * 8) {
        version = VERSIONS[versionNo];
        data = encodeData(text, capacity);
        break;
      }
    }
    if (!version) {
      throw new Error('Join address is too long for the class QR code');
    }
    codewords = interleave(data, version);
    base = makeMatrix(version, codewords);
    for (mask = 0; mask < 8; mask++) {
      grid = copyGrid(base.dark);
      for (r = 0; r < version.size; r++) {
        for (c = 0; c < version.size; c++) {
          if (base.reserved[r][c]) {
            continue;
          }
          if (MASKS[mask](r, c)) {
            grid[r][c] = !grid[r][c];
          }
        }
      }
      applyFormat(grid, mask);
      score = penalty(grid);
      if (score < bestScore) {
        bestScore = score;
        best = grid;
      }
    }
    return best;
  }

  function svg(text) {
    var grid = matrix(text);
    var n = grid.length;
    var quiet = 4;
    var dim = n + quiet * 2;
    var parts = [];
    var r;
    var c;
    var start;
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim +
        ' ' + dim + '" shape-rendering="crispEdges" role="img" aria-label="QR code to join the race">');
    parts.push('<rect width="' + dim + '" height="' + dim + '" fill="#ffffff"/>');
    for (r = 0; r < n; r++) {
      c = 0;
      while (c < n) {
        if (!grid[r][c]) {
          c++;
          continue;
        }
        start = c;
        while (c < n && grid[r][c]) {
          c++;
        }
        parts.push('<rect x="' + (start + quiet) + '" y="' + (r + quiet) +
            '" width="' + (c - start) + '" height="1" fill="#030A03"/>');
      }
    }
    parts.push('</svg>');
    return parts.join('');
  }

  return {matrix: matrix, svg: svg};
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThinkaQr;
}
