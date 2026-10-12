# Copyright 2026 Thinka
# SPDX-License-Identifier: Apache-2.0
"""Tiny WebSocket framing so the race host needs only the Python standard library."""

import base64
import hashlib
import os
import struct

GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
MAX_PAYLOAD = 8192


def accept_value(key):
  digest = hashlib.sha1((key + GUID).encode('ascii')).digest()
  return base64.b64encode(digest).decode('ascii')


def _read_exact(sock, n):
  buf = bytearray()
  while len(buf) < n:
    chunk = sock.recv(n - len(buf))
    if not chunk:
      raise ConnectionError('socket closed')
    buf.extend(chunk)
  return bytes(buf)


def read_frame(sock, require_mask=True):
  """Return (opcode, payload). Browser client frames are masked."""
  hdr = _read_exact(sock, 2)
  opcode = hdr[0] & 0x0F
  masked = bool(hdr[1] & 0x80)
  length = hdr[1] & 0x7F
  if length == 126:
    length = struct.unpack('!H', _read_exact(sock, 2))[0]
  elif length == 127:
    length = struct.unpack('!Q', _read_exact(sock, 8))[0]
  if length > MAX_PAYLOAD:
    raise ValueError('frame too large')
  mask = _read_exact(sock, 4) if masked else None
  payload = _read_exact(sock, length) if length else b''
  if mask:
    payload = bytes(payload[i] ^ mask[i % 4] for i in range(len(payload)))
  elif length and require_mask:
    raise ValueError('client frames must be masked')
  return opcode, payload


def encode_text(text, mask=False):
  data = text.encode('utf-8')
  n = len(data)
  header = bytearray([0x81])
  if n < 126:
    header.append(n | (0x80 if mask else 0))
  elif n < 65536:
    header.append(126 | (0x80 if mask else 0))
    header.extend(struct.pack('!H', n))
  else:
    header.append(127 | (0x80 if mask else 0))
    header.extend(struct.pack('!Q', n))
  if mask:
    key = os.urandom(4)
    data = bytes(data[i] ^ key[i % 4] for i in range(len(data)))
    return bytes(header) + key + data
  return bytes(header) + data


def write_text(sock, text):
  sock.sendall(encode_text(text, mask=False))


def write_pong(sock, payload):
  header = bytes([0x8A, len(payload)])
  sock.sendall(header + payload)
