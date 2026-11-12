Bug-Lizzer TV bridge
====================
Lets the Bug-Lizzer Planning app turn the LG TV on/off and open Disney+.

1. Double-click "Start TV bridge.bat". (First time: if Node.js isn't installed it opens the
   download page — install the LTS version, then double-click again.)
2. The first time it connects, the TV shows a request — accept it with the remote.
3. Leave the window open (minimize it). Optional: double-click "Start with Windows.bat"
   so it starts on its own after a restart.

For "TV on" to work when the TV is off, turn on (TV settings):
  General → Devices → External Devices → "Turn on via Wi-Fi" (or "Mobile TV On"),
  and keep this PC from sleeping (Windows Settings → System → Power → Sleep: Never).

config.json holds this PC's private bridge key — don't share it.
