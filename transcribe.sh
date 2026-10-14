#!/usr/bin/env bash
# Post-event transcript for the live auction recording, using whisper.cpp on the MacBook.
# Usage:  ./transcribe.sh path/to/recording.m4a  [model]
#   model: base.en (default, good balance on an Intel Mac) | small.en (more accurate, slower) | tiny.en (fastest)
# Output: a .srt file next to the recording. Import it in the app under Audio & transcript.
set -euo pipefail

IN="${1:-}"
MODEL="${2:-base.en}"
if [[ -z "$IN" || ! -f "$IN" ]]; then
  echo "Usage: ./transcribe.sh path/to/recording.m4a [base.en|small.en|tiny.en]"; exit 1
fi

command -v brew >/dev/null || { echo "Homebrew is needed first: https://brew.sh"; exit 1; }
command -v ffmpeg >/dev/null || brew install ffmpeg
if ! command -v whisper-cli >/dev/null && ! command -v whisper-cpp >/dev/null; then brew install whisper-cpp; fi
WHISPER="$(command -v whisper-cli || command -v whisper-cpp)"

MODEL_DIR="$HOME/.whisper-models"
MODEL_FILE="$MODEL_DIR/ggml-$MODEL.bin"
mkdir -p "$MODEL_DIR"
if [[ ! -f "$MODEL_FILE" ]]; then
  echo "Downloading the $MODEL model (one time)…"
  curl -L --fail -o "$MODEL_FILE" "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$MODEL.bin"
fi

BASE="${IN%.*}"
WAV="$BASE.16k.wav"
echo "Converting to 16 kHz mono…"
ffmpeg -y -loglevel error -i "$IN" -ar 16000 -ac 1 -c:a pcm_s16le "$WAV"

echo "Transcribing (this can take a while on an Intel Mac; leave it running)…"
"$WHISPER" -m "$MODEL_FILE" -f "$WAV" -osrt -of "$BASE" -t "$(sysctl -n hw.ncpu)" \
  --prompt "Charity auction. Paddle number, bidder number, sold, dollars."

rm -f "$WAV"
echo "Done: $BASE.srt"
