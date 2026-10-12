/**
 * Thinka Race client. The teacher server owns positions; this page
 * draws them and sends keystrokes.
 */
'use strict';

(function() {
  var app = document.getElementById('app');
  var socket = null;
  var state = null;
  var errorText = '';
  var nameDraft = '';
  var urls = [];
  var offline = false;
  var seenLine = null;
  var lineFlashUntil = 0;

  function esc(text) {
    return String(text == null ? '' : text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
  }

  function send(message) {
    if (socket && socket.readyState === 1) {
      socket.send(JSON.stringify(message));
    }
  }

  function connect() {
    var proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    try {
      socket = new WebSocket(proto + location.host + '/race/ws');
    } catch (err) {
      offline = true;
      render();
      return;
    }
    socket.addEventListener('open', function() {
      offline = false;
      render();
    });
    socket.addEventListener('message', function(event) {
      var message = JSON.parse(event.data);
      if (message.type === 'error') {
        errorText = message.message;
      } else if (message.type === 'state') {
        state = message;
        if (message.you) {
          errorText = '';
        }
      }
      render();
    });
    socket.addEventListener('close', function() {
      offline = true;
      render();
    });
  }

  function loadUrls() {
    fetch('/race/info').then(function(response) {
      return response.json();
    }).then(function(info) {
      urls = info.urls || [];
      render();
    }).catch(function() {
      urls = [];
    });
  }

  function me() {
    if (!state || !state.yourId) {
      return null;
    }
    var players = state.players || [];
    for (var i = 0; i < players.length; i++) {
      if (players[i].id === state.yourId) {
        return players[i];
      }
    }
    return null;
  }

  function promptHtml(line, pos) {
    var unit = line.charAt(line.length - 1) === ' ' ? line : line + ' ';
    var at = pos % unit.length;
    var shown = '';
    for (var i = 0; i < 22; i++) {
      var ch = unit.charAt((at + i) % unit.length);
      if (ch === ' ') {
        ch = '\u00a0';
      }
      shown += i === 0 ? '<b>' + esc(ch) + '</b>' : esc(ch);
    }
    return shown;
  }

  function carSvg(color, left) {
    var paint = esc(color);
    return '<svg class="race-car" style="left:' + left +
        '%" viewBox="0 0 72 40" aria-hidden="true">' +
        '<rect x="6" y="16" width="58" height="14" rx="4" fill="' + paint + '"/>' +
        '<path d="M18 16 L28 6 H48 L56 16 Z" fill="' + paint + '"/>' +
        '<path d="M30 8 H46 L52 15 H26 Z" fill="#F8FAFC"/>' +
        '<circle cx="62" cy="20" r="2.5" fill="#FACC15"/>' +
        '<circle cx="20" cy="30" r="6" fill="#030A03"/>' +
        '<circle cx="52" cy="30" r="6" fill="#030A03"/>' +
        '<circle cx="20" cy="30" r="2.5" fill="#94A3B8"/>' +
        '<circle cx="52" cy="30" r="2.5" fill="#94A3B8"/>' +
        '</svg>';
  }

  function lanes(players) {
    var leader = 1;
    players.forEach(function(player) {
      if (player.pos > leader) {
        leader = player.pos;
      }
    });
    var scale = Math.max(leader, 24);
    return '<div class="race-lanes">' + players.map(function(player) {
      var left = Math.max(6, Math.min(94, (player.pos / scale) * 88 + 6));
      var badges = player.bot ? 'computer' : '';
      if (player.speed) {
        badges += (badges ? ' · ' : '') + 'x2';
      }
      if (player.shield) {
        badges += (badges ? ' · ' : '') + 'shield';
      }
      var mine = state && player.id === state.yourId;
      return '<div class="race-lane' + (player.connected ? '' : ' race-gone') +
          (mine ? ' race-lane--me' : '') + '">' +
          '<div class="race-who"><i class="race-swatch" style="background:' +
          esc(player.color) + '"></i> ' + esc(player.name) + '</div>' +
          '<div class="race-track">' + carSvg(player.color, left) + '</div>' +
          '<div class="race-meta">' + player.pos +
          (badges ? '<span>' + esc(badges) + '</span>' : '') + '</div></div>';
    }).join('') + '</div>';
  }

  function podium(players) {
    var top = players.slice(0, 3);
    var order = [top[1], top[0], top[2]];
    var html = '<div class="race-podium">';
    order.forEach(function(player) {
      if (!player) {
        return;
      }
      html += '<div class="race-place race-place--' + player.place + '">' +
          '<span>' + player.place + '</span><strong>' + esc(player.name) +
          '</strong><span>' + player.pos + '</span></div>';
    });
    html += '</div>';
    if (players.length > 3) {
      html += '<ol class="race-rest">';
      players.slice(3).forEach(function(player) {
        html += '<li>' + player.place + '. ' + esc(player.name) + ' · ' +
            player.pos + '</li>';
      });
      html += '</ol>';
    }
    return html;
  }

  function rulesLine() {
    var rules = (state && state.rules) || {};
    return 'Five correct letters in a row count double. Ten earn a shield. ' +
        'Three wrong letters in a row move you back ' + (rules.knockBy || 3) + '.';
  }

  function render() {
    if (offline && !state) {
      app.innerHTML = '<div class="race-gate"><a class="race-logo" href="index.html">thinka<span>.</span></a>' +
          '<h1>Race needs the Thinka server</h1>' +
          '<p class="race-lead">On the teacher laptop run <strong>python3 serve.py --port 8088</strong>, then open this page again. A plain file server cannot host the class.</p></div>';
      return;
    }
    if (!state || !state.you) {
      app.innerHTML = '<div class="race-gate"><a class="race-logo" href="index.html">thinka<span>.</span></a>' +
          '<h1>Typing race</h1>' +
          '<p class="race-lead">Thirty seconds. Same line for everyone. The teacher hosts on this WiFi.</p>' +
          '<div class="race-actions"><button type="button" id="hostBtn">Host the class</button></div>' +
          '<label>Or join with your name<input id="nameInput" type="text" maxlength="16" autocomplete="off" value="' +
          esc(nameDraft) + '"></label>' +
          '<div class="race-actions"><button type="button" id="joinBtn">Join</button></div>' +
          '<p class="race-error">' + esc(errorText) + '</p></div>';
      bindGate();
      return;
    }
    if (state.phase === 'lobby') {
      renderLobby();
      return;
    }
    if (state.phase === 'countdown') {
      app.innerHTML = '<div class="race-board"><div class="race-count">' +
          esc(state.countdown) + '</div>' + lineBanner() + lanes(state.players) + '</div>';
      return;
    }
    if (state.phase === 'race') {
      renderRace();
      return;
    }
    renderPodium();
  }

  function bindGate() {
    var nameInput = document.getElementById('nameInput');
    nameInput.addEventListener('input', function() {
      nameDraft = nameInput.value;
    });
    document.getElementById('hostBtn').addEventListener('click', function() {
      send({type: 'host'});
    });
    document.getElementById('joinBtn').addEventListener('click', function() {
      send({type: 'join', name: nameInput.value});
    });
    nameInput.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
        send({type: 'join', name: nameInput.value});
      }
    });
  }

  function renderLobby() {
    var teacher = state.you === 'teacher';
    var address = urls[0] || location.origin + '/race.html';
    var roster = (state.players || []).map(function(player) {
      return '<div><i class="race-swatch" style="background:' + esc(player.color) +
          '"></i>' + esc(player.name) + '</div>';
    }).join('') || '<p class="race-lead">Waiting for students.</p>';
    var humans = (state.players || []).filter(function(player) {
      return !player.bot;
    }).length;
    var fill = humans > 0 && humans < 4 ?
        '<p class="race-lead">Computer racers join at the start so the track has 4 cars.</p>' : '';
    var levels = [
      ['easy', 'Easy'],
      ['medium', 'Medium'],
      ['hard', 'Hard']
    ].map(function(level) {
      var on = state.difficulty === level[0] ? ' is-on' : '';
      return '<button type="button" class="race-line race-diff' + on +
          '" data-diff="' + level[0] + '"' + (teacher ? '' : ' disabled') + '>' +
          level[1] + '</button>';
    }).join('');
    var start = teacher ?
        '<button type="button" id="startBtn"' +
        ((state.players && state.players.length) ? '' : ' disabled') +
        '>Start</button>' : '';
    app.innerHTML = '<div class="race-lobby"><div class="race-top"><a class="race-logo" href="index.html">thinka<span>.</span></a></div>' +
        '<h1>' + (teacher ? 'Host the class' : 'You are in') + '</h1>' +
        (teacher ? '<p class="race-lead">Students on this WiFi open:</p><div class="race-url">' +
            esc(address) + '</div>' : '<p class="race-lead">Wait for the teacher to start. The line changes by itself during the race.</p>') +
        '<h2>Computer speed</h2><div class="race-lines race-diffs">' + levels +
        '</div><p class="race-rules">Same setting, different speeds. One computer is slower, one is quicker.</p>' +
        '<h2>Racers</h2><div class="race-roster">' + roster + '</div>' + fill +
        '<p class="race-rules">' + esc(rulesLine()) + '</p>' +
        '<div class="race-actions">' + start + '</div>' +
        '<p class="race-error">' + esc(errorText) + '</p></div>';
    if (teacher) {
      document.getElementById('startBtn').addEventListener('click', function() {
        send({type: 'start'});
      });
      app.querySelectorAll('[data-diff]').forEach(function(button) {
        button.addEventListener('click', function() {
          send({type: 'difficulty', difficulty: button.getAttribute('data-diff')});
        });
      });
    }
  }

  function lineBanner() {
    if (state.lineId !== seenLine) {
      if (seenLine && state.phase === 'race') {
        lineFlashUntil = Date.now() + 700;
      }
      seenLine = state.lineId;
    }
    var flash = Date.now() < lineFlashUntil ? ' race-now--flash' : '';
    return '<p class="race-now' + flash + '">' + esc(state.line) + '</p>';
  }

  function renderRace() {
    var player = me();
    var seconds = Math.ceil((state.msLeft || 0) / 1000);
    var typing = '';
    if (player) {
      typing = '<div class="race-prompt" aria-live="polite">' +
          promptHtml(state.line, player.pos) + '</div><p class="race-rules">' +
          esc(rulesLine()) + '</p>';
    }
    app.innerHTML = '<div class="race-board"><div class="race-top"><a class="race-logo" href="index.html">thinka<span>.</span></a>' +
        '<div class="race-clock">' + seconds + '</div></div>' +
        lineBanner() + lanes(state.players) + typing + '</div>';
  }

  function renderPodium() {
    var teacher = state.you === 'teacher';
    var winner = (state.players || [])[0];
    app.innerHTML = '<div class="race-board"><h1>' +
        (winner ? esc(winner.name) + ' wins' : 'Race over') + '</h1>' +
        podium(state.players || []) +
        (teacher ? '<button type="button" id="againBtn">New race</button>' :
            '<p class="race-lead">Wait for the teacher to start a new race.</p>') +
        '</div>';
    if (teacher) {
      document.getElementById('againBtn').addEventListener('click', function() {
        send({type: 'again'});
      });
    }
  }

  document.addEventListener('keydown', function(event) {
    if (!state || state.phase !== 'race' || state.you !== 'player') {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
      return;
    }
    if (event.key !== ' ' && event.key.length !== 1) {
      return;
    }
    event.preventDefault();
    send({type: 'key', key: event.key});
  });

  connect();
  loadUrls();
  render();
})();
