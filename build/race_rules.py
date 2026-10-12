# Copyright 2026 Thinka
# SPDX-License-Identifier: Apache-2.0
"""Authoritative rules for the classroom LAN typing race.

The teacher machine runs one room. Clients send keys; only this module
moves a car. Prototype tunables (feel, not product locks):

  5 correct in a row  -> each correct key counts double
  10 correct in a row -> a shield that blocks the next knockback
  3 wrong in a row    -> knock the car back 3 letters
"""

import random

SPEED_AT = 5
SHIELD_AT = 10
KNOCK_AT = 3
KNOCK_BY = 3
ROUND_MS = 30000
COUNTDOWN_SEC = 3
LINE_MIN_MS = 4000
LINE_MAX_MS = 8000
MAX_PLAYERS = 16
MAX_NAME = 16
MIN_RACERS = 4

# Keystrokes per second. Slow on purpose so a student who is still
# finding the keys can stay with them. Each computer in a race gets a
# different rate inside the band.
DIFFICULTIES = {
    'easy': (0.18, 0.35),
    'medium': (0.38, 0.63),
    'hard': (0.67, 1.0),
}
BOT_NAMES = (
    'Zippy', 'Bolt', 'Nova', 'Pixel', 'Comet', 'Nibbles',
    'Sparky', 'Pogo', 'Jinx', 'Rocket', 'Wobble', 'Glimmer',
)

# Letters and spaces only. A trailing space is added between repeats so
# the last word does not glue to the first.
LINES = (
    ('cats', 'the cat sat on the mat'),
    ('zoom', 'ready set go zoom'),
    ('moon', 'zoom to the moon and back'),
    ('bugs', 'bees buzz and frogs hop'),
    ('stars', 'five stars shine at night'),
    ('fast', 'type fast and win the race'),
)

COLORS = (
    '#FF4500', '#FACC15', '#60A5FA', '#4ADE80',
    '#C084FC', '#F472B6', '#2DD4BF', '#FB923C',
    '#A3E635', '#38BDF8', '#F9A8D4', '#FDE047',
    '#86EFAC', '#93C5FD', '#FDBA74', '#E9D5FF',
)


def line_by_id(line_id):
  for item in LINES:
    if item[0] == line_id:
      return item
  return None


def unit_text(line):
  return line if line.endswith(' ') else line + ' '


def char_at(line, pos):
  unit = unit_text(line)
  return unit[pos % len(unit)]


def attempt_key(key):
  """A letter or space the racer meant to type, or None to ignore."""
  if key == ' ':
    return ' '
  if isinstance(key, str) and len(key) == 1 and key.isalpha():
    return key.lower()
  return None


def clean_name(name):
  if not isinstance(name, str):
    return None
  collapsed = ' '.join(name.split())
  if not collapsed or len(collapsed) > MAX_NAME:
    return None
  for ch in collapsed:
    if ch != ' ' and ch != '-' and ch != "'" and not ch.isalpha():
      return None
  return collapsed


class Player(object):
  def __init__(self, pid, name, color, joined_at):
    self.id = pid
    self.name = name
    self.color = color
    self.pos = 0
    self.streak = 0
    self.wrongs = 0
    self.shield = False
    self.shield_this_streak = False
    self.connected = True
    self.bot = False
    self.cps = 0
    self.charge = 0
    self.joined_at = joined_at
    self.reached_at = joined_at

  def reset_run(self, now):
    self.pos = 0
    self.streak = 0
    self.wrongs = 0
    self.shield = False
    self.shield_this_streak = False
    self.reached_at = now

  def to_public(self, place):
    return {
        'id': self.id,
        'name': self.name,
        'color': self.color,
        'pos': self.pos,
        'streak': self.streak,
        'wrongs': self.wrongs,
        'shield': self.shield,
        'speed': self.streak >= SPEED_AT,
        'connected': self.connected,
        'bot': self.bot,
        'place': place,
    }


class Room(object):
  def __init__(self, now=0, rng=None):
    self.phase = 'lobby'
    self.line_id = LINES[0][0]
    self.line = LINES[0][1]
    self.players = {}
    self.order = []
    self.teacher_id = None
    self.teacher_connected = False
    self.countdown_left = None
    self.countdown_anchor = None
    self.race_ends = None
    self.difficulty = 'easy'
    self.rng = rng or random.Random()
    self.next_line_at = None
    self._bot_clock = None
    self._colors = 0
    self._ids = 0
    self.now = now

  def _next_id(self, prefix):
    self._ids += 1
    return '%s%d' % (prefix, self._ids)

  def line_choices(self):
    return [{'id': item[0], 'text': item[1]} for item in LINES]

  def host(self, now):
    """Claim the teacher seat. Reclaim it when the previous teacher is gone."""
    self.now = now
    if self.teacher_id and self.teacher_connected:
      return None, 'This class already has a teacher.'
    self.teacher_id = self._next_id('t')
    self.teacher_connected = True
    return self.teacher_id, None

  def drop_teacher(self, teacher_id):
    if teacher_id == self.teacher_id:
      self.teacher_connected = False

  def join(self, name, now):
    self.now = now
    if self.phase != 'lobby':
      return None, 'The race has already started.'
    if len(self.order) >= MAX_PLAYERS:
      return None, 'This race is full.'
    cleaned = clean_name(name)
    if not cleaned:
      return None, 'Use a name with letters only, up to %d characters.' % MAX_NAME
    for player in self.players.values():
      if player.name.casefold() == cleaned.casefold():
        return None, 'That name is already in this race.'
    pid = self._next_id('p')
    color = COLORS[self._colors % len(COLORS)]
    self._colors += 1
    player = Player(pid, cleaned, color, now)
    self.players[pid] = player
    self.order.append(pid)
    return pid, None

  def drop_player(self, pid):
    player = self.players.get(pid)
    if not player:
      return
    if self.phase == 'lobby':
      self.order.remove(pid)
      del self.players[pid]
      return
    player.connected = False

  def _choose_line(self):
    choices = [item for item in LINES if item[0] != self.line_id]
    picked = self.rng.choice(choices or list(LINES))
    self.line_id = picked[0]
    self.line = picked[1]

  def _schedule_line(self, now):
    self.next_line_at = now + self.rng.randint(LINE_MIN_MS, LINE_MAX_MS)

  def set_difficulty(self, teacher_id, difficulty):
    if teacher_id != self.teacher_id or not self.teacher_connected:
      return 'Only the teacher can set the difficulty.'
    if self.phase != 'lobby':
      return 'Difficulty locks when the race starts.'
    if difficulty not in DIFFICULTIES:
      return 'Unknown difficulty.'
    self.difficulty = difficulty
    return None

  def _fill_bots(self, now):
    humans = [player for player in self.connected_players() if not player.bot]
    need = MIN_RACERS - len(humans)
    if need <= 0:
      return
    low, high = DIFFICULTIES[self.difficulty]
    if need == 1:
      speeds = [(low + high) / 2.0]
    else:
      step = (high - low) / (need - 1)
      speeds = [low + step * i for i in range(need)]
    taken = {player.name.casefold() for player in self.players.values()}
    names = [name for name in BOT_NAMES if name.casefold() not in taken]
    for index in range(need):
      pid = self._next_id('b')
      color = COLORS[self._colors % len(COLORS)]
      self._colors += 1
      bot = Player(pid, names[index], color, now)
      bot.bot = True
      bot.cps = speeds[index]
      self.players[pid] = bot
      self.order.append(pid)

  def _advance_bots(self, now):
    if self._bot_clock is None:
      self._bot_clock = now
      return
    elapsed = (now - self._bot_clock) / 1000.0
    if elapsed <= 0:
      return
    self._bot_clock = now
    if self.race_ends is not None and now > self.race_ends:
      return
    for pid in list(self.order):
      player = self.players[pid]
      if not player.bot:
        continue
      player.charge += elapsed * player.cps
      while player.charge >= 1:
        player.charge -= 1
        self._correct(player, now)

  def connected_players(self):
    return [self.players[pid] for pid in self.order if self.players[pid].connected]

  def start(self, teacher_id, now):
    self.now = now
    if teacher_id != self.teacher_id or not self.teacher_connected:
      return 'Only the teacher can start the race.'
    if self.phase != 'lobby':
      return 'The race is already going.'
    humans = [player for player in self.connected_players() if not player.bot]
    if not humans:
      return 'Wait for at least one student.'
    self._fill_bots(now)
    self._choose_line()
    self.phase = 'countdown'
    self.countdown_left = COUNTDOWN_SEC
    self.countdown_anchor = now
    self.race_ends = None
    return None

  def again(self, teacher_id, now):
    self.now = now
    if teacher_id != self.teacher_id or not self.teacher_connected:
      return 'Only the teacher can start a new race.'
    if self.phase != 'podium':
      return 'Finish this race first.'
    kept = []
    for pid in self.order:
      player = self.players[pid]
      if player.bot or not player.connected:
        del self.players[pid]
        continue
      player.reset_run(now)
      kept.append(pid)
    self.order = kept
    self.phase = 'lobby'
    self.countdown_left = None
    self.countdown_anchor = None
    self.race_ends = None
    return None

  def tick(self, now):
    self.now = now
    if self.phase == 'countdown':
      elapsed = now - self.countdown_anchor
      steps = int(elapsed // 1000)
      if steps > 0:
        self.countdown_left -= steps
        self.countdown_anchor += steps * 1000
      if self.countdown_left <= 0:
        self.phase = 'race'
        self.countdown_left = None
        self.race_ends = now + ROUND_MS
        self._bot_clock = now
        self._schedule_line(now)
    elif self.phase == 'race':
      if self.next_line_at is not None and now >= self.next_line_at:
        self._choose_line()
        self._schedule_line(now)
      self._advance_bots(now)
      if self.race_ends is not None and now >= self.race_ends:
        self.phase = 'podium'
    return self.phase

  def key(self, pid, key, now):
    self.now = now
    if self.phase != 'race':
      return
    player = self.players.get(pid)
    if not player or not player.connected or player.bot:
      return
    typed = attempt_key(key)
    if typed is None:
      return
    expected = char_at(self.line, player.pos)
    if typed == expected:
      self._correct(player, now)
    else:
      self._wrong(player, now)

  def _correct(self, player, now):
    player.wrongs = 0
    player.streak += 1
    step = 2 if player.streak >= SPEED_AT else 1
    player.pos += step
    player.reached_at = now
    if (player.streak >= SHIELD_AT and not player.shield and
        not player.shield_this_streak):
      player.shield = True
      player.shield_this_streak = True

  def _wrong(self, player, now):
    player.streak = 0
    player.shield_this_streak = False
    player.wrongs += 1
    if player.wrongs < KNOCK_AT:
      return
    player.wrongs = 0
    if player.shield:
      player.shield = False
      return
    player.pos = max(0, player.pos - KNOCK_BY)
    player.reached_at = now

  def ranked(self):
    rows = [self.players[pid] for pid in self.order]
    rows.sort(key=lambda player: (-player.pos, player.reached_at, player.joined_at))
    return rows

  def snapshot(self, conn_id, now):
    self.tick(now)
    ranked = self.ranked()
    places = {player.id: index + 1 for index, player in enumerate(ranked)}
    ms_left = 0
    if self.phase == 'race' and self.race_ends is not None:
      ms_left = max(0, self.race_ends - now)
    role = None
    if conn_id and conn_id == self.teacher_id:
      role = 'teacher'
    elif conn_id in self.players:
      role = 'player'
    you = self.players.get(conn_id)
    return {
        'type': 'state',
        'phase': self.phase,
        'lineId': self.line_id,
        'line': self.line,
        'difficulty': self.difficulty,
        'lines': self.line_choices(),
        'countdown': self.countdown_left,
        'msLeft': ms_left,
        'you': role,
        'yourId': conn_id if you else None,
        'need': char_at(self.line, you.pos) if you and self.phase == 'race' else None,
        'players': [player.to_public(places[player.id]) for player in ranked],
        'rules': {
            'speedAt': SPEED_AT,
            'shieldAt': SHIELD_AT,
            'knockAt': KNOCK_AT,
            'knockBy': KNOCK_BY,
            'roundMs': ROUND_MS,
        },
    }
