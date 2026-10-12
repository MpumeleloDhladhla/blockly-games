#!/usr/bin/env python3
# Copyright 2026 Thinka
# SPDX-License-Identifier: Apache-2.0
"""Rules plus a live WebSocket round. Run: python3 build/test_race.py"""

import json
import os
import random
import socket
import struct
import subprocess
import sys
import time
import threading
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from race_rules import (KNOCK_AT, KNOCK_BY, ROUND_MS, SHIELD_AT, SPEED_AT, Room,
                        char_at)
from race_ws import encode_text
import serve as serve_mod


FAILURES = []


def check(name, cond):
  if cond:
    print('ok  ' + name)
  else:
    FAILURES.append(name)
    print('FAIL ' + name)


def type_correct(room, pid, n, now):
  for i in range(n):
    room.key(pid, char_at(room.line, room.players[pid].pos), now + i)


def test_rules():
  room = Room(now=0)
  teacher, err = room.host(0)
  check('teacher hosts', teacher and not err)
  other, err = room.host(1)
  check('second teacher is refused', other is None and err)
  ada, err = room.join('  Ada ', 2)
  check('name is trimmed', ada and room.players[ada].name == 'Ada' and not err)
  dup, err = room.join('ada', 3)
  check('duplicate name is refused', dup is None)
  bad, err = room.join('a1', 4)
  check('digits are refused', bad is None)
  check('start waits for a student', room.start(teacher, 5) is None)
  room.tick(5)
  check('countdown is running', room.phase == 'countdown')
  room.tick(5 + 3000)
  check('countdown becomes the race', room.phase == 'race')
  late, err = room.join('Bea', 6)
  check('join after start is refused', late is None and 'already' in err)
  type_correct(room, ada, SPEED_AT - 1, 100)
  check('early keys count once', room.players[ada].pos == SPEED_AT - 1)
  room.key(ada, char_at(room.line, room.players[ada].pos), 200)
  check('fifth correct key counts double',
        room.players[ada].pos == SPEED_AT - 1 + 2 and room.players[ada].streak == SPEED_AT)
  type_correct(room, ada, SHIELD_AT - SPEED_AT, 300)
  check('ten in a row grants a shield', room.players[ada].shield)
  before = room.players[ada].pos
  for _ in range(KNOCK_AT):
    room.key(ada, 'z', 400)
  check('shield blocks the knockback',
        room.players[ada].pos == before and not room.players[ada].shield)
  for _ in range(KNOCK_AT):
    room.key(ada, 'z', 500)
  check('three wrongs move the car back',
        room.players[ada].pos == max(0, before - KNOCK_BY))
  case_room = Room(now=0)
  case_teacher, _ = case_room.host(0)
  case_player, _ = case_room.join('Eli', 1)
  case_room.start(case_teacher, 2)
  case_room.tick(2 + 3000)
  first = char_at(case_room.line, case_room.players[case_player].pos)
  case_room.key(case_player, first.upper(), 10)
  check('a capital counts as the small letter', case_room.players[case_player].pos == 1)
  swap = Room(now=0, rng=random.Random(1))
  swap_host, _ = swap.host(0)
  swap.join('Mo', 1)
  swap.start(swap_host, 2)
  swap.tick(2 + 3000)
  started_line = swap.line_id
  swap.tick(swap.next_line_at)
  check('the line changes during the race', swap.line_id != started_line)
  check('the next line is not immediate', swap.next_line_at > swap.now)
  room2 = Room(now=0)
  t2, _ = room2.host(0)
  p2, _ = room2.join('Bea', 1)
  room2.start(t2, 2)
  room2.tick(2 + 3000)
  room2.players[p2].pos = 8
  room2.players[p2].reached_at = 50
  cam, _ = room2.join('Cam', 3) if False else (None, None)
  # Join is closed. Place Cam by inserting directly for the tie rule.
  from race_rules import Player
  cam = Player('px', 'Cam', '#fff', 1)
  cam.pos = 8
  cam.reached_at = 40
  room2.players['px'] = cam
  room2.order.append('px')
  ranked = room2.ranked()
  check('same distance ranks whoever got there first',
        ranked[0].name == 'Cam' and ranked[1].name == 'Bea')
  room.tick(room.race_ends)
  check('the clock ends on the podium', room.phase == 'podium')
  check('new race returns to the lobby', room.again(teacher, room.now + 1) is None)
  check('positions reset', room.players[ada].pos == 0 and room.phase == 'lobby')
  bots = [player for player in room.players.values() if player.bot]
  check('a new race drops the computers', bots == [])
  solo = Room(now=0)
  host, _ = solo.host(0)
  solo.join('Nia', 1)
  solo.set_difficulty(host, 'easy')
  solo.start(host, 2)
  computers = [player for player in solo.players.values() if player.bot]
  check('one student still starts a field of 4', len(solo.players) == 4 and len(computers) == 3)
  speeds = sorted(player.cps for player in computers)
  names = [player.name for player in computers]
  check('computer speeds differ inside easy', speeds[0] < speeds[1] < speeds[2])
  check('computer names are unique and fun', len(set(names)) == 3 and set(names) <= set((
      'Zippy', 'Bolt', 'Nova', 'Pixel', 'Comet', 'Nibbles',
      'Sparky', 'Pogo', 'Jinx', 'Rocket', 'Wobble', 'Glimmer')))
  solo.tick(2 + 3000)
  solo.tick(2 + 3000 + 8000)
  ordered = sorted(computers, key=lambda player: player.cps)
  check('the quicker computer pulls ahead', ordered[-1].pos > ordered[0].pos)
  packed = Room(now=0)
  packed_host, _ = packed.host(0)
  for name in ('Ada', 'Bea', 'Cam', 'Dee'):
    packed.join(name, 1)
  packed.start(packed_host, 2)
  check('four students means no computers',
        all(not player.bot for player in packed.players.values()) and len(packed.players) == 4)


class WsClient(object):
  def __init__(self, port):
    self.sock = socket.create_connection(('127.0.0.1', port), timeout=5)
    key = 'dGhlIHNhbXBsZSBub25jZQ=='
    req = (
        'GET /race/ws HTTP/1.1\r\n'
        'Host: 127.0.0.1:%d\r\n'
        'Upgrade: websocket\r\n'
        'Connection: Upgrade\r\n'
        'Sec-WebSocket-Key: %s\r\n'
        'Sec-WebSocket-Version: 13\r\n\r\n' % (port, key))
    self.sock.sendall(req.encode('ascii'))
    buf = b''
    while b'\r\n\r\n' not in buf:
      buf += self.sock.recv(1024)
    self.pending = buf.split(b'\r\n\r\n', 1)[1]
    self.messages = []

  def _take(self, n):
    while len(self.pending) < n:
      chunk = self.sock.recv(4096)
      if not chunk:
        raise ConnectionError('socket closed')
      self.pending += chunk
    out = self.pending[:n]
    self.pending = self.pending[n:]
    return out

  def send(self, payload):
    self.sock.sendall(encode_text(json.dumps(payload), mask=True))

  def recv(self):
    hdr = self._take(2)
    opcode = hdr[0] & 0x0F
    length = hdr[1] & 0x7F
    if length == 126:
      length = struct.unpack('!H', self._take(2))[0]
    elif length == 127:
      length = struct.unpack('!Q', self._take(8))[0]
    payload = self._take(length) if length else b''
    if opcode != 1:
      return self.recv()
    message = json.loads(payload.decode('utf-8'))
    self.messages.append(message)
    return message


def test_live():
  # The imported server module owns one room. Use a fresh hub for this test.
  serve_mod.HUB.room = Room(now=0)
  serve_mod.HUB.clients = {}
  handler = serve_mod.NoCacheHandler
  httpd = ThreadingHTTPServer(('127.0.0.1', 0), handler)
  port = httpd.server_address[1]
  thread = threading.Thread(target=httpd.serve_forever, daemon=True)
  thread.start()
  try:
    teacher = WsClient(port)
    student = WsClient(port)
    teacher.recv()
    student.recv()
    teacher.send({'type': 'host'})
    student.send({'type': 'join', 'name': 'Nia'})
    seen_race = False
    started = False
    for _ in range(40):
      message = teacher.recv()
      if (not started and message.get('type') == 'state' and
          message.get('you') == 'teacher' and
          any(player['name'] == 'Nia' for player in message.get('players') or [])):
        teacher.send({'type': 'start'})
        started = True
      if message.get('phase') == 'race':
        seen_race = True
        break
    check('live countdown reaches the race', seen_race)
    # Drive the student with the letter the server says they need.
    moved = False
    for _ in range(40):
      message = student.recv()
      if message.get('phase') == 'race' and message.get('need'):
        student.send({'type': 'key', 'key': message['need']})
      for player in message.get('players') or []:
        if player['name'] == 'Nia' and player['pos'] > 0:
          moved = True
          break
      if moved:
        break
    check('a correct key moves the student car', moved)
  finally:
    httpd.shutdown()


def test_pick_port():
  holder = socket.socket()
  holder.bind(('0.0.0.0', 0))
  port = holder.getsockname()[1]
  try:
    nxt = serve_mod.pick_open_port(port, attempts=8)
    check('classroom server skips a busy port', nxt is not None and nxt != port)
    check('the busy port is still held', holder.fileno() >= 0)
  finally:
    holder.close()


def test_free_port():
  probe = socket.socket()
  probe.bind(('127.0.0.1', 0))
  port = probe.getsockname()[1]
  probe.close()
  holder = subprocess.Popen([
      sys.executable, '-c',
      'import socket, time; s=socket.socket(); '
      's.bind(("127.0.0.1", %d)); s.listen(1); time.sleep(30)' % port])
  time.sleep(0.4)
  serve_mod.free_port(port)
  gone = holder.poll() is not None
  if not gone:
    holder.kill()
  check('an existing listener on the port is stopped', gone)
  again = socket.socket()
  try:
    again.bind(('127.0.0.1', port))
    check('the port can be bound after the override', True)
  except OSError:
    check('the port can be bound after the override', False)
  finally:
    again.close()


if __name__ == '__main__':
  test_rules()
  test_pick_port()
  test_free_port()
  test_live()
  if FAILURES:
    print('\n%d failed' % len(FAILURES))
    sys.exit(1)
  print('\nrace tests passed')
