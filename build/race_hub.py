# Copyright 2026 Thinka
# SPDX-License-Identifier: Apache-2.0
"""One in-process race room shared by every browser on the teacher machine."""

import json
import socket
import threading
import time

from race_rules import Room
from race_ws import read_frame, write_pong, write_text


def lan_ips():
  found = []
  try:
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    probe.connect(('192.0.2.1', 9))
    ip = probe.getsockname()[0]
    probe.close()
    if ip and not ip.startswith('127.'):
      found.append(ip)
  except OSError:
    pass
  try:
    for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
      ip = info[4][0]
      if ip.startswith('127.') or ip in found:
        continue
      found.append(ip)
  except OSError:
    pass
  return found


class RaceHub(object):
  def __init__(self):
    self.room = Room(now=0)
    self.lock = threading.Lock()
    self.clients = {}
    self._seq = 0
    self._ticking = False

  def now_ms(self):
    return int(time.time() * 1000)

  def ensure_tick(self):
    if self._ticking:
      return
    self._ticking = True
    thread = threading.Thread(target=self._tick_loop, name='race-tick', daemon=True)
    thread.start()

  def _tick_loop(self):
    while True:
      time.sleep(0.1)
      with self.lock:
        phase = self.room.phase
        if phase in ('countdown', 'race'):
          self.room.tick(self.now_ms())
          self._broadcast_locked()

  def info(self, port):
    urls = ['http://%s:%d/race.html' % (ip, port) for ip in lan_ips()]
    return {'urls': urls, 'port': port}

  def attach(self, sock):
    self.ensure_tick()
    try:
      sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
    except OSError:
      pass
    with self.lock:
      self._seq += 1
      conn_id = 'c%d' % self._seq
      self.clients[conn_id] = {'sock': sock, 'role_id': None}
    try:
      self._send(conn_id, self._state(conn_id))
      while True:
        opcode, payload = read_frame(sock)
        if opcode == 0x8:
          break
        if opcode == 0x9:
          write_pong(sock, payload)
          continue
        if opcode != 0x1:
          continue
        self._on_message(conn_id, payload)
    except (ConnectionError, OSError, ValueError, json.JSONDecodeError):
      pass
    finally:
      self._detach(conn_id)

  def _detach(self, conn_id):
    with self.lock:
      client = self.clients.pop(conn_id, None)
      if not client:
        return
      role_id = client['role_id']
      if role_id:
        if role_id == self.room.teacher_id:
          self.room.drop_teacher(role_id)
        else:
          self.room.drop_player(role_id)
      self._broadcast_locked()

  def _on_message(self, conn_id, payload):
    message = json.loads(payload.decode('utf-8'))
    if not isinstance(message, dict):
      return
    kind = message.get('type')
    with self.lock:
      client = self.clients.get(conn_id)
      if not client:
        return
      now = self.now_ms()
      error = None
      if kind == 'host':
        if client['role_id']:
          error = 'You are already in this race.'
        else:
          teacher_id, error = self.room.host(now)
          if teacher_id:
            client['role_id'] = teacher_id
      elif kind == 'join':
        if client['role_id']:
          error = 'You are already in this race.'
        else:
          pid, error = self.room.join(message.get('name'), now)
          if pid:
            client['role_id'] = pid
      elif kind == 'difficulty':
        error = self.room.set_difficulty(client['role_id'], message.get('difficulty'))
      elif kind == 'start':
        error = self.room.start(client['role_id'], now)
      elif kind == 'again':
        error = self.room.again(client['role_id'], now)
      elif kind == 'key':
        self.room.key(client['role_id'], message.get('key'), now)
      if error:
        self._send(conn_id, {'type': 'error', 'message': error})
      self.room.tick(now)
      self._broadcast_locked()

  def _state(self, conn_id):
    role_id = None
    client = self.clients.get(conn_id)
    if client:
      role_id = client['role_id']
    return self.room.snapshot(role_id, self.now_ms())

  def _send(self, conn_id, payload):
    client = self.clients.get(conn_id)
    if not client:
      return
    try:
      write_text(client['sock'], json.dumps(payload))
    except OSError:
      pass

  def _broadcast_locked(self):
    for conn_id in list(self.clients):
      self._send(conn_id, self._state(conn_id))


HUB = RaceHub()
