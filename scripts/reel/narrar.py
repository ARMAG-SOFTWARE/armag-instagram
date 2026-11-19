"""Narração do Reel com a voz do Jeff (Piper, pt_BR, licença CC0).
Uso: python3 scripts/reel/narrar.py <roteiro.txt> <pasta_saida>
Saída: <pasta>/narracao.wav (48 kHz mono) e <pasta>/tempos.json  [{texto, inicio, fim}]
Voz: $PIPER_VOICES/pt_BR-jeff-medium.onnx
"""
import json, os, re, subprocess, sys, wave
import numpy as np
from piper import PiperVoice, SynthesisConfig

roteiro = open(sys.argv[1], encoding="utf-8").read().strip()
saida = sys.argv[2]
os.makedirs(saida, exist_ok=True)
voz = PiperVoice.load(os.path.join(os.environ.get("PIPER_VOICES", "vozes"), "pt_BR-jeff-medium.onnx"))
cfg = SynthesisConfig(length_scale=0.95, noise_scale=0.55, noise_w_scale=0.5)
SR, PAUSA = 48000, 0.22

frases = [f.strip() for f in re.split(r"(?<=[.!?])\s+", roteiro) if f.strip()]
partes, tempos, t = [], [], 0.0
for i, frase in enumerate(frases):
    bruto, limpo = os.path.join(saida, f"_f{i}.wav"), os.path.join(saida, f"_f{i}_48k.wav")
    with wave.open(bruto, "wb") as w:
        voz.synthesize_wav(frase, w, syn_config=cfg)
    # 48 kHz, corta silêncio das pontas, compressão leve e presença (voz comercial)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", bruto, "-af",
        "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02,"
        "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,areverse,"
        "highpass=f=80,equalizer=f=180:t=q:w=1:g=2,equalizer=f=3500:t=q:w=1.2:g=3,"
        "acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=3,aresample=48000",
        "-ac", "1", limpo], check=True)
    with wave.open(limpo) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    os.remove(bruto); os.remove(limpo)
    dur = len(x) / SR
    tempos.append({"texto": frase, "inicio": round(t, 3), "fim": round(t + dur, 3)})
    partes.append(x)
    t += dur
    if i < len(frases) - 1:
        partes.append(np.zeros(int(PAUSA * SR), dtype=np.int16))
        t += PAUSA

with wave.open(os.path.join(saida, "narracao.wav"), "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(np.concatenate(partes).tobytes())
json.dump(tempos, open(os.path.join(saida, "tempos.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"narração: {t:.2f}s em {len(frases)} frases")
