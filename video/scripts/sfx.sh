#!/usr/bin/env bash
# Synthesises all sound effects with ffmpeg (no downloaded assets).
set -euo pipefail
mkdir -p public/sfx
f() { ffmpeg -y -v error -f lavfi -i "$1" -af "$2" -ar 44100 -ac 1 "public/sfx/$3.wav"; }

f "anoisesrc=d=0.7:c=pink:a=0.9" "bandpass=f=900:w=1400,afade=t=in:d=0.3,afade=t=out:st=0.35:d=0.35" whoosh
f "sine=f=1600:d=0.06" "afade=t=out:st=0.01:d=0.05,volume=0.6" click
f "sine=f=520:d=0.14" "asetrate=44100*1.4,aresample=44100,afade=t=out:st=0.02:d=0.12" pop
f "anoisesrc=d=0.035:c=white:a=0.5" "highpass=f=2500,afade=t=out:d=0.035" key
f "sine=f=55:d=1.2" "afade=t=out:st=0.05:d=1.15,volume=2.5" hit
f "sine=f=1320:d=0.9" "afade=t=out:st=0.02:d=0.88,volume=0.7" ding
f "anoisesrc=d=1.6:c=pink:a=0.7" "bandpass=f=600:w=900,afade=t=in:d=1.4,afade=t=out:st=1.4:d=0.2" riser
f "sine=f=220:d=0.5" "vibrato=f=18:d=0.6,afade=t=out:st=0.05:d=0.45,volume=0.8" alarm
echo "sfx written to public/sfx"
