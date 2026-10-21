# usage: python3 pipeline/transcribe.py [audio/*.mp3]   (downloads a small speech model on first use)
import glob, sys
from faster_whisper import WhisperModel
model = WhisperModel('small.en', device='cpu', compute_type='int8')
for f in sys.argv[1:] or sorted(glob.glob('audio/*.mp3')):
    segs, _ = model.transcribe(f, beam_size=5, language='en')
    print('==', f, '\n  ', ' '.join(s.text.strip() for s in segs))
