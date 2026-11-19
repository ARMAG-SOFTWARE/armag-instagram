"""Música e efeitos do Reel (sintetizados do zero, livres de direitos) + mixagem com a narração.
Uso: python3 scripts/reel/audio.py <pasta>   (lê <pasta>/plano.json e <pasta>/narracao.wav)
plano.json: {"duracao", "inicio_fala", "final", "transicoes": [t...], "itens": [t...]}
Saída: <pasta>/mix.wav  (48 kHz estéreo, −14 LUFS; música abaixa sob a voz)
"""
import json, os, subprocess, sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt, fftconvolve

P = sys.argv[1]
PL = json.load(open(os.path.join(P, "plano.json")))
SR = 48000
DUR = PL["duracao"]
N = int(DUR * SR)
rng = np.random.default_rng(11)
ta = lambda s: np.arange(int(s * SR)) / SR
lp = lambda x, f: sosfilt(butter(2, f, "low", fs=SR, output="sos"), x)
hp = lambda x, f, o=2: sosfilt(butter(o, f, "high", fs=SR, output="sos"), x)
bp = lambda x, a, b: sosfilt(butter(2, [a, b], "band", fs=SR, output="sos"), x)
nota = lambda m: 440.0 * 2 ** ((m - 69) / 12)


def place(buf, sig, at, g=1.0):
    i = int(at * SR)
    if i < 0 or i >= len(buf):
        return
    sig = sig[: len(buf) - i]
    buf[i : i + len(sig)] += sig * g


def env(n, a, d):
    t = np.arange(n) / SR
    return np.where(t < a, t / max(a, 1e-4), np.exp(-(t - a) / d))


def saw(f, s, dt=0.0):
    return 2 * ((ta(s) * f * (1 + dt)) % 1.0) - 1


def reverb(x, s=1.6, mix=0.25):
    ir = rng.standard_normal(len(ta(s))) * np.exp(-ta(s) * 4)
    w = fftconvolve(x, lp(ir, 6000))[: len(x)]
    return x * (1 - mix) + w / (np.max(np.abs(w)) + 1e-9) * mix * np.max(np.abs(x))


def kick():
    t = ta(0.45)
    s = np.sin(2 * np.pi * np.cumsum(45 + 75 * np.exp(-t * 28)) / SR) * np.exp(-t * 7.5)
    return np.tanh(s * 1.6) * 0.85


def clap():
    n = int(0.25 * SR); e = np.zeros(n)
    for k in range(3):
        i = int(k * 0.011 * SR); e[i:] += np.exp(-np.arange(n - i) / SR / (0.012 if k < 2 else 0.07))
    return bp(rng.standard_normal(n), 900, 3800) * e * 0.45


def hat():
    n = int(0.045 * SR)
    return hp(rng.standard_normal(n), 7500, 4) * env(n, 0.001, 0.012) * 0.18


def pad(notas, s):
    x = sum(saw(nota(m), s, dt) for m in notas for dt in (-0.006, 0, 0.007))
    x = lp(x / (len(notas) * 3), 1300)
    e = np.ones(len(x)); a = int(0.4 * SR); e[:a] = np.linspace(0, 1, a)
    return x * e


def baixo(m, s):
    t = ta(s)
    x = np.sin(2 * np.pi * nota(m) * t) + 0.25 * np.sin(4 * np.pi * nota(m) * t)
    return np.tanh(x * 1.3) * np.minimum(1, t / 0.01) * np.exp(-t * 2.4) * 0.5


def pluck(m, s=0.3):
    x = saw(nota(m), s) + 0.5 * saw(nota(m + 12), s)
    return lp(x, 2600) * env(len(x), 0.002, 0.1) * 0.3


# ---------- música: Am – F – C – G, 100 bpm, entra suave e cresce ----------
beat = 60 / 100; bar = beat * 4
music, drums, padbus, side = (np.zeros(N) for _ in range(4))
prog = [([57, 60, 64], 45), ([53, 57, 60], 41), ([55, 60, 64], 48), ([55, 59, 62], 43)]
final = PL["final"]
t, i = 0.0, 0
while t < final + bar:
    notas, raiz = prog[i % 4]
    place(padbus, pad(notas, bar + 0.3), t)
    for b in range(4):
        bt = t + b * beat
        if bt >= final:
            break
        cheio = bt >= PL["inicio_fala"] + 1.2  # bateria completa depois da primeira frase
        place(drums, kick(), bt, 1.0 if (b in (0, 2) or cheio) else 0.0)
        place(side, np.exp(-ta(beat) * 9), bt)
        if cheio and b in (1, 3):
            place(drums, clap(), bt)
        place(drums, hat(), bt + beat / 2, 1.0 if cheio else 0.5)
        for e8 in range(2):
            place(music, baixo(raiz - 12, beat / 2), bt + e8 * beat / 2, 1.0 if cheio else 0.6)
        if bt >= (PL["itens"][0] if PL["itens"] else final - 2):
            for e8 in range(2):
                place(music, pluck(notas[(b * 2 + e8) % 3] + 12), bt + e8 * beat / 2, 0.7)
    t += bar; i += 1

padbus = reverb(padbus, 1.8, 0.3) * (1 - 0.5 * np.clip(side, 0, 1)) * 0.5
drums = reverb(drums, 0.9, 0.12)
crash = hp(rng.standard_normal(int(2.2 * SR)), 5000) * env(int(2.2 * SR), 0.002, 0.7) * 0.3
place(drums, kick() * 1.2, final); place(drums, crash, final)
place(padbus, pad([57, 60, 64, 69], DUR - final + 0.1) * env(int((DUR - final + 0.1) * SR), 0.01, 1.2) * 0.6, final)
corte = int(final * SR)
music[corte:] *= np.linspace(1, 0, len(music) - corte) ** 2
music = hp(music + padbus + drums, 30)
music /= np.max(np.abs(music)) + 1e-9
f = int(0.7 * SR); music[-f:] *= np.linspace(1, 0, f)

# ---------- efeitos ----------
sfx = np.zeros(N)


def whoosh():
    n = int(0.7 * SR); t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 350, 4200) * np.where(t < 0.26, (t / 0.26) ** 2, np.exp(-(t - 0.26) / 0.12)) * 0.4


def pop():
    t = ta(0.12)
    return np.sin(2 * np.pi * np.cumsum(700 + 900 * (t / 0.12)) / SR) * np.exp(-t * 30) * 0.22


def brilho():
    out = np.zeros(int(1.4 * SR))
    for k, fr in enumerate([2093, 2637, 3136, 4186]):
        t = ta(1.2); s = np.sin(2 * np.pi * fr * t) * np.exp(-t * 3.5); i = int(k * 0.06 * SR); out[i : i + len(s)] += s
    return out * 0.08


for tr in PL["transicoes"]:
    place(sfx, whoosh(), tr - 0.26)
for it in PL["itens"]:
    place(sfx, pop(), it)
place(sfx, brilho(), final + 0.2)

# ---------- narração ----------
sr, vo_raw = wavfile.read(os.path.join(P, "narracao.wav"))
vo = np.zeros(N)
place(vo, vo_raw.astype(np.float32) / 32768.0, PL["inicio_fala"])


def salvar(nome, x, pico):
    wavfile.write(os.path.join(P, nome), SR, (x / (np.max(np.abs(x)) + 1e-9) * pico * 32767).astype(np.int16))


salvar("_musica.wav", music, 0.89); salvar("_efeitos.wav", sfx, 0.8); salvar("_voz.wav", vo, 0.95)
A = lambda n: os.path.join(P, n)
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", A("_musica.wav"), "-i", A("_voz.wav"), "-i", A("_efeitos.wav"),
    "-filter_complex",
    "[1:a]asplit=2[vo][vosc];[0:a]volume=0.5[mus];"
    "[mus][vosc]sidechaincompress=threshold=0.03:ratio=8:attack=15:release=350:makeup=1[duck];"
    "[2:a]volume=0.7[fx];[duck][vo][fx]amix=inputs=3:normalize=0,alimiter=limit=0.95,"
    "loudnorm=I=-14:TP=-1.0:LRA=9,aresample=48000[out]",
    "-map", "[out]", "-ac", "2", A("mix.wav")], check=True)
for n in ("_musica.wav", "_efeitos.wav", "_voz.wav"):
    os.remove(A(n))
print("ok: mix.wav")
