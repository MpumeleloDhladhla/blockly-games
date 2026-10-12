Thinka Blockly Games — offline classroom pack
=============================================

This ZIP is a complete, offline-first copy of Thinka’s Blockly Games
(https://thinka.org.za). It does not need App Engine, Python, or the
internet after you unzip it.

How to play
-----------

1. Unzip this archive.

2. Either:
   a) Open thinka.html (or blockly-games.html) in a web browser, or
   b) Serve the folder with any static file server, then open index.html.

   Recommended for Chrome (progress is shared across games):

     python3 -m http.server 8080
     # then visit http://localhost:8080/blockly-games/index.html

   Opening files directly (file://) works for playing a single game.
   Chrome isolates localStorage per file:// URL, so the index page
   gauges and “Clear data” may not see progress from maze.html etc.
   A local static server avoids that.

3. Teacher password (default: thinka) unlocks a locked level. Progress
   and unlocks are stored in that browser’s localStorage only.

Arcade (mouse and keyboard skills)
----------------------------------

Arcade is the free-play game: five zones of six levels each, training
mouse aim, drag and drop, and keyboard speed. The first two levels of
every zone are slow warm-ups. Every level gives a score, so a class can
compete.

- Every Arcade level is unlocked, so the whole class can play the same
  one. The other games still use the sequential locks.
- Ask each child to tap “Playing as” and type their name before playing.
  Scores are filed under that name.
- “Champions” shows the top five per level plus an overall ranking.
- The scoreboard lives on that one computer, in the browser. It is not
  shared between machines, and the hub’s “Clear data” button erases it
  along with all other progress.

What is not included
--------------------

- Cloud “share by link” / App Engine storage
- Online gallery (view / submit)
- Error-report POSTs and Google Analytics
- Reddit gallery redirects
- Any runtime CDN or backend

Build this ZIP from source with:  make deps && make games && make offline
See the repository README for details.
