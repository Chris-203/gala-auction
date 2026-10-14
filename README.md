# Gala Auction Clerk

A web app for the clerk at the live auction. The auctioneer runs the room; the clerk logs every bid (paddle number + amount) and calls each lot sold or passed. A live transcript listens to the auctioneer and suggests bids for the clerk to confirm.

## Files

- `index.html` – the app
- `parser.js` – turns auctioneer speech ("six hundred, paddle 42") into bid suggestions
- `transcribe.sh` – post-event transcript of the full recording with Whisper

## Put it online (Vercel)

Speech recognition and the microphone only work on an `https://` address (or `localhost`), so don't open `index.html` by double-clicking.

1. Push this folder to a GitHub repo, then import it in Vercel. No build settings needed; it's a static site.
   Or from the folder: `npx vercel` and follow the prompts.
2. Open the Vercel URL in **Chrome** on the MacBook and allow the microphone when asked.

To test locally instead: `python3 -m http.server 8000` in this folder, then open http://localhost:8000.

## Before the gala

- **Lots & paddles tab:** remove the example lots, then add your items or import a CSV (`lot, title, donor, opening, increment`). Paste the paddle list from check-in (`101, Jordan Ellis`, one per line).
- **Download a backup** (same tab) once everything is entered.
- **Offline fallback:** the Whisper model downloads in the background a few seconds after the page loads (about 40 MB). Wait for "Offline fallback: ready ✓" before the auction starts, and **don't reload the page during the event**, or the fallback has to download again.
- **Microphone:** Chrome speech uses the Mac's current input (System Settings → Sound → Input). If AV gives you a sound-board feed through a USB audio interface, select it there.
- **Mac settings for the night:** plugged in, sleep and screen saver off, notifications off.
- **Rehearse** in the room with the auctioneer for a few lots.

## During the auction

1. Select a lot and press **Open bidding**. This timestamps the lot so its audio can be found later.
2. Press **Start** on the live transcript.
3. For each bid the auctioneer calls: type the paddle number and press **Enter**. The amount fills in with the next increment; change it if the auctioneer jumps.
4. When a suggestion appears under "Heard a bid?", press **⌘ Enter** to record it or **Esc** to dismiss it. Suggestions are never recorded on their own.
5. **⌥ Z** undoes the last bid. Removed bids stay in the history (struck through) and can be restored.
6. **Sold to #42** → **Confirm sale**. Or **Pass (unsold)**. The app then offers the next lot.

If Chrome speech fails (wifi drops, repeated errors), the app switches to offline Whisper on the laptop automatically. If both fail, keep typing bids; the transcript is a helper, not the record.

Everything saves in the browser as you go. Download a backup when the auction ends.

## After the auction

- **Results tab:** what each paddle owes for checkout, results by lot, and CSV downloads (results, paddle totals, every bid, transcript).
- **Audio & transcript tab:**
  1. Load the spare person's recording, then set when it started, either by typing the time or by playing it, pausing where a lot opens, and pressing "This moment is that lot opening."
  2. Every lot then gets a **Play clip** button for its stretch of the recording.
  3. For a clean full transcript, run on the MacBook:

     ```bash
     chmod +x transcribe.sh
     ./transcribe.sh ~/Downloads/auction-recording.m4a          # base.en model
     ./transcribe.sh ~/Downloads/auction-recording.m4a small.en # more accurate, slower
     ```

     It installs ffmpeg and whisper.cpp through Homebrew the first time. On a 2020 Intel MacBook Pro, expect a 2-hour recording to take roughly 30 minutes to a couple of hours, depending on the model. Import the resulting `.srt` and each line is filed under its lot.

## Limits to know

- One clerk device. The data lives in that laptop's browser; there's no live view on a second device.
- Loaded audio files aren't stored, so load them again after a reload.
- The laptop's own backup recording (Audio tab, section 3) must be saved before closing the tab.
