# Record the complete PreSymp MVP

This records the running local app with Playwright and creates an English narrated MP4, a silent master, a WAV narration stem, timed script, optional subtitles, chapter metadata and verification images in `artifacts/walkthrough/`.

The workflow uses the real report parser, OCR, matching, source viewer, exports and Sarvam endpoints. All bundled patients are fictional. The three microphone examples use Sarvam-generated synthetic audio through a browser-only input in the recording context. The production microphone implementation is unchanged. Voice and backup/send limitations are explained in the narration.

Start the built app with a configured server-side Sarvam key:

```powershell
npm run build
npm start
```

In a second terminal:

```powershell
node scripts/walkthrough/prepare.mjs
node scripts/walkthrough/record.mjs --rehearse
node scripts/walkthrough/record.mjs
python scripts/walkthrough/render.py
```

`prepare.mjs` uses the local voice gateway to generate and cache English narration. `record.mjs` interacts with the actual app in a separate clean browser context. It saves downloaded card images, PDFs, audio, CSV and FHIR examples. `render.py` uses imageio-ffmpeg, OpenCV, NumPy and Pillow to encode H.264 video, add AAC narration, embed optional English subtitles, write chapters and verify the entire final file can be decoded.

To rehearse only the later voice, reminder, export and settings sections:

```powershell
node scripts/walkthrough/record.mjs --rehearse --voices-only
```

Edit `scenes.mjs` to change narration. Remove the corresponding cached audio file in `artifacts/walkthrough/audio/` before regenerating a changed paragraph. Narration timing follows actual scene timestamps from the recording; subtitles use phrase timing estimated from the generated speech length.
