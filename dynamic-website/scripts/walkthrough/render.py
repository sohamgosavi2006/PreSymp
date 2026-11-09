"""Mux the real screen recording with timed English narration, then verify it."""
from pathlib import Path
import json
import math
import re
import subprocess
import wave

import cv2
import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw

root = Path('artifacts/walkthrough').resolve()
timeline = json.loads((root / 'timeline.json').read_text(encoding='utf-8'))
source = json.loads((root / 'video-source.json').read_text(encoding='utf-8'))
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
raw = Path(source['path'])
probe = subprocess.run([ffmpeg, '-hide_banner', '-i', str(raw)], capture_output=True, text=True)
match = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', probe.stderr)
if not match:
    raise RuntimeError('Cannot read captured video duration')
duration = int(match[1]) * 3600 + int(match[2]) * 60 + float(match[3])
rate = 22050
track = np.zeros(int(math.ceil(duration + 1) * rate), dtype=np.int32)

def stamp(seconds, srt=False):
    ms = max(0, round(seconds * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f'{h:02}:{m:02}:{s:02}{"," if srt else "."}{ms:03}'

subtitles = []
chapters = [';FFMETADATA1', 'title=PreSymp Kidney Map — Complete MVP Walkthrough', 'artist=PreSymp', 'comment=English synthetic narration with Sarvam. Fictional patients and synthetic microphone demonstrations.']
script = ['# PreSymp Kidney Map — complete English walkthrough', '', f'Runtime: {stamp(duration)}. English narration: Sarvam Bulbul v3, Shubh. All patient data and microphone examples are synthetic. This video records the actual local MVP; sending and backup screens are labelled as demo features.', '', 'The MP4 contains the narrator track. The silent MP4, narration WAV, chapter timestamps and subtitle file are included separately for editing.', '']
for i, scene in enumerate(timeline):
    # Browser capture starts just after newPage; keep the spoken lead-in slightly after each chapter.
    start = scene['start'] + 0.4
    with wave.open(scene['path'], 'rb') as wav:
        if (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) != (1, 2, rate):
            raise RuntimeError('Narration format mismatch')
        clip = np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').astype(np.int32)
    offset = round(start * rate)
    end = min(len(track), offset + len(clip))
    track[offset:end] += clip[:end - offset]
    chapter_end = timeline[i + 1]['start'] if i + 1 < len(timeline) else duration
    chapters.extend(['[CHAPTER]', 'TIMEBASE=1/1000', f'START={round(scene["start"] * 1000)}', f'END={round(chapter_end * 1000)}', f'title={scene["title"]}'])
    script.extend([f'## {stamp(scene["start"])} — {scene["title"]}', '', scene['narration'], ''])
    # Readable subtitle phrases, weighted by word count over the actual generated speech duration.
    words = scene['narration'].split()
    chunks = []
    current = []
    for word in words:
        current.append(word)
        if len(current) >= 10 or (len(current) >= 5 and word.endswith(('.', ';', ':', '?'))):
            chunks.append(current)
            current = []
    if current:
        chunks.append(current)
    used = 0
    for chunk in chunks:
        cue_start = start + scene['duration'] * used / len(words)
        used += len(chunk)
        cue_end = start + scene['duration'] * used / len(words)
        text = ' '.join(chunk)
        if len(text) > 60:
            split = min(range(1, len(chunk)), key=lambda n: abs(len(' '.join(chunk[:n])) - len(' '.join(chunk[n:]))))
            text = ' '.join(chunk[:split]) + '\n' + ' '.join(chunk[split:])
        subtitles.append(f'{len(subtitles) + 1}\n{stamp(cue_start, True)} --> {stamp(cue_end, True)}\n{text}\n')

track = np.clip(track[:round(duration * rate)], -32768, 32767).astype('<i2')
with wave.open(str(root / 'english-narration.wav'), 'wb') as wav:
    wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(rate); wav.writeframes(track.tobytes())
(root / 'chapters.ffmeta').write_text('\n'.join(chapters) + '\n', encoding='utf-8')
(root / 'voiceover-script.md').write_text('\n'.join(script), encoding='utf-8')
(root / 'english-subtitles.srt').write_text('\n'.join(subtitles), encoding='utf-8')

silent = root / 'presymp-complete-walkthrough-silent.mp4'
narrated = root / 'presymp-complete-walkthrough-english.mp4'
def run(args):
    result = subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', *map(str, args)], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr[-4000:])

print(f'Encoding silent master, {duration:.1f} seconds...', flush=True)
run(['-i', raw, '-i', root / 'chapters.ffmeta', '-map', '0:v:0', '-map_metadata', '1', '-map_chapters', '1', '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '25', '-an', '-movflags', '+faststart', silent])
print('Muxing English narration and optional subtitles...', flush=True)
run(['-i', silent, '-i', root / 'english-narration.wav', '-i', root / 'english-subtitles.srt', '-map', '0:v:0', '-map', '1:a:0', '-map', '2:s:0', '-map_metadata', '0', '-map_chapters', '0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '1', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:s', 'mov_text', '-metadata:s:a:0', 'language=eng', '-metadata:s:s:0', 'language=eng', '-t', duration, '-movflags', '+faststart', narrated])
print('Verifying video, audio and chapter frames...', flush=True)
run(['-i', narrated, '-map', '0:v:0', '-map', '0:a:0', '-f', 'null', '-'])
cap = cv2.VideoCapture(str(narrated))
frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)); fps = cap.get(cv2.CAP_PROP_FPS)
width, height = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
tiles = []
frame_dir = root / 'verified-frames'
frame_dir.mkdir(exist_ok=True)
for i, scene in enumerate(timeline):
    moment = min(scene['end'] - 0.5, scene['start'] + max(1.5, (scene['end'] - scene['start']) * 0.6))
    cap.set(cv2.CAP_PROP_POS_MSEC, moment * 1000)
    ok, frame = cap.read()
    if not ok:
        raise RuntimeError(f'Missing frame: {scene["id"]}')
    cv2.imwrite(str(frame_dir / f'{i + 1:02}-{scene["id"]}.jpg'), frame)
    thumb = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).resize((480, 270))
    tile = Image.new('RGB', (480, 302), '#fafaf7'); tile.paste(thumb, (0, 0))
    draw = ImageDraw.Draw(tile); draw.text((10, 278), f'{i + 1:02}  {scene["id"]}   {stamp(moment)}', fill='#1a1a1a')
    tiles.append(tile)
cap.release()
sheet = Image.new('RGB', (480 * 3, 302 * math.ceil(len(tiles) / 3)), '#d9d9d4')
for i, tile in enumerate(tiles):
    sheet.paste(tile, ((i % 3) * 480, (i // 3) * 302))
sheet.save(root / 'walkthrough-contact-sheet.jpg', quality=90)
summary = {'duration_seconds': frames / fps, 'width': width, 'height': height, 'fps': fps, 'chapters': len(timeline), 'narrated_bytes': narrated.stat().st_size, 'silent_bytes': silent.stat().st_size, 'audio_peak': int(np.max(np.abs(track.astype(np.int32)))), 'full_decode': 'passed'}
(root / 'verification.json').write_text(json.dumps(summary, indent=2), encoding='utf-8')
print(json.dumps(summary), flush=True)
