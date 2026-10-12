#!/usr/bin/env python3
# Copyright 2026 Thinka
# SPDX-License-Identifier: Apache-2.0
"""Serve appengine/ so http://localhost:8088/ is the Thinka hub.

Works on macOS (Homebrew Python) and Linux. Falls back to IPv4 if
binding [::] fails.
"""

import argparse
import functools
import json
import os
import signal
import socket
import subprocess
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    'appengine')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from race_hub import HUB  # noqa: E402
from race_ws import accept_value  # noqa: E402


class NoCacheHandler(SimpleHTTPRequestHandler):
  def end_headers(self):
    self.send_header('Cache-Control', 'no-store, max-age=0')
    self.send_header('Pragma', 'no-cache')
    super().end_headers()

  def do_GET(self):
    path = urlparse(self.path).path
    if path == '/race/ws':
      self._race_ws()
      return
    if path == '/race/info':
      self._race_info()
      return
    super().do_GET()

  def _race_info(self):
    port = self.server.server_address[1]
    body = json.dumps(HUB.info(port)).encode('utf-8')
    self.send_response(200)
    self.send_header('Content-Type', 'application/json; charset=utf-8')
    self.send_header('Content-Length', str(len(body)))
    self.end_headers()
    self.wfile.write(body)

  def _race_ws(self):
    key = self.headers.get('Sec-WebSocket-Key')
    upgrade = (self.headers.get('Upgrade') or '').lower()
    if not key or upgrade != 'websocket':
      self.send_error(400, 'Expected a WebSocket')
      return
    self.send_response(101, 'Switching Protocols')
    self.send_header('Upgrade', 'websocket')
    self.send_header('Connection', 'Upgrade')
    self.send_header('Sec-WebSocket-Accept', accept_value(key.strip()))
    self.end_headers()
    HUB.attach(self.connection)


class DualStackServer(ThreadingHTTPServer):
  address_family = socket.AF_INET6

  def server_bind(self):
    try:
      self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
    except OSError:
      pass
    super().server_bind()


def listeners(port):
  """Process ids listening on this TCP port, excluding this process."""
  try:
    out = subprocess.run(
        ['lsof', '-nP', '-t', '-iTCP:%d' % port, '-sTCP:LISTEN'],
        capture_output=True, text=True, check=False)
  except FileNotFoundError:
    return []
  pids = []
  for line in (out.stdout or '').split():
    if not line.isdigit():
      continue
    pid = int(line)
    if pid != os.getpid():
      pids.append(pid)
  return pids


def free_port(port):
  """Stop whatever is already serving this port so a new server can bind."""
  found = listeners(port)
  if not found:
    return
  print('Replacing server already on port %d (%s)' % (
      port, ', '.join(str(pid) for pid in found)), flush=True)
  for pid in found:
    try:
      os.kill(pid, signal.SIGTERM)
    except OSError:
      pass
  deadline = time.time() + 1.5
  while time.time() < deadline and listeners(port):
    time.sleep(0.05)
  for pid in listeners(port):
    try:
      os.kill(pid, signal.SIGKILL)
    except OSError:
      pass
  deadline = time.time() + 1.0
  while time.time() < deadline and listeners(port):
    time.sleep(0.05)


def make_server(bind, port, handler):
  ThreadingHTTPServer.allow_reuse_address = True
  free_port(port)
  if bind in ('::', '', '*'):
    try:
      return DualStackServer(('::', port), handler)
    except OSError:
      bind = '0.0.0.0'
  return ThreadingHTTPServer((bind, port), handler)


def main():
  parser = argparse.ArgumentParser(description='Serve Thinka Games (appengine/)')
  parser.add_argument('--port', type=int, default=8088)
  parser.add_argument('--bind', default='::')
  args = parser.parse_args()
  if not os.path.isdir(ROOT):
    raise SystemExit('Missing %s — run this from the Thinka repo after '
                     'checking out the visual-theme branch.' % ROOT)
  handler = functools.partial(NoCacheHandler, directory=ROOT)
  server = make_server(args.bind, args.port, handler)
  print('Thinka hub: http://127.0.0.1:%d/' % args.port, flush=True)
  print('Also:       http://[::]:%d/' % args.port, flush=True)
  print('Serving %s (no-cache)' % ROOT, flush=True)
  server.serve_forever()


if __name__ == '__main__':
  main()
