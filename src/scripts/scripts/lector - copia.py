#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import serial
import threading
import time
import random
from datetime import datetime
import os
import csv
import queue
import sys
import socket
import re
import xml.etree.ElementTree as ET
import numpy as np

import tkinter as tk
from PIL import Image, ImageTk

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ============================================================
# GESTIÓN DE AFINIDAD DE CPU (solo Windows, por hilo)
# ============================================================
IS_WINDOWS = (os.name == "nt")

if IS_WINDOWS:
    import ctypes
    import ctypes.wintypes as wt

class CpuAffinityManager:
    """
    Asigna afinidad de CPU a hilos específicos.
    En Windows usa SetThreadAffinityMask.
    En otros SO no hace nada (solo loggea).
    """
    def __init__(self):
        self.is_windows = IS_WINDOWS
        if self.is_windows:
            self.kernel32 = ctypes.windll.kernel32

    def set_for_current_thread(self, cores):
        """
        cores: lista de índices de núcleo (0-based), por ejemplo [0,1,2,3]
        """
        if not self.is_windows:
            print("[AFFINITY] Afinidad por hilo no implementada en este SO.")
            return

        if not cores:
            return

        mask = 0
        for c in cores:
            if c >= 0:
                mask |= (1 << int(c))

        import threading
        thread_id = threading.get_native_id()  # ID nativo del hilo (Windows thread ID)

        # THREAD_SET_INFORMATION (0x20) | THREAD_QUERY_INFORMATION (0x40) | THREAD_SET_LIMITED_INFORMATION (0x200)
        THREAD_SET_INFORMATION = 0x0020
        THREAD_QUERY_INFORMATION = 0x0040
        THREAD_SET_LIMITTED_INFORMATION = 0x0200
        access = THREAD_SET_INFORMATION | THREAD_QUERY_INFORMATION | THREAD_SET_LIMITTED_INFORMATION

        handle = self.kernel32.OpenThread(access, False, thread_id)
        if not handle:
            print("[AFFINITY] No se pudo abrir el hilo para establecer afinidad.")
            return

        try:
            res = self.kernel32.SetThreadAffinityMask(handle, mask)
            if res == 0:
                print("[AFFINITY] Error al fijar afinidad (SetThreadAffinityMask=0).")
            else:
                print(f"[AFFINITY] Hilo actual fijado a núcleos: {cores}")
        finally:
            self.kernel32.CloseHandle(handle)

CPU_AFFINITY = CpuAffinityManager()

# ============================================================
# MP3 playback (pygame)
# ============================================================
try:
    import pygame
    PYGAME_OK = True
except Exception as e:
    print("[WARN] pygame no disponible:", e)
    PYGAME_OK = False

# ============================================================
# Video (OpenCV)
# ============================================================
try:
    import cv2
    CV2_OK = True
except Exception as e:
    print("[WARN] OpenCV (cv2) no disponible:", e)
    CV2_OK = False

# ============================================================
# Audio (micrófono / webcam)
# ============================================================
try:
    import sounddevice as sd
    import soundfile as sf
    AUDIO_OK = True
except Exception as e:
    print("[WARN] Dependencias de audio (sounddevice/soundfile) no disponibles:", e)
    sd = None
    sf = None
    AUDIO_OK = False

# ============================================================
# CONFIGURACIÓN SERIAL / SESIONES
# ============================================================
PORT = "COM9"               # <- ajusta si cambia
BAUD = 115200
TIMEOUT = 1

# Bloques
NUM_BLOCKS = 1
MINUTES_PER_BLOCK = 1.22               # minutos por bloque
STIM_BLOCKS = [0, 2, 4]               # índices (0-based) con estímulos; los demás = lectura libre

# Descanso entre bloques
REST_BETWEEN_BLOCKS_S = 60           # 60 segundos de descanso entre bloques

# Intervalos/duraciones (solo para bloques de estimulación)
INTERVALO_MIN = 5
INTERVALO_MAX = 5
DURACION_MIN = 1
DURACION_MAX = 3

# Cupos por tipo (se cumplen en el conjunto de STIM_BLOCKS)
QUOTAS = {
    "V": 0,    # visual (gifs PC)
    "K": 5,    # kinestésico (serial "K dur")
    "A": 5,    # auditivo en micro (serial "A dur")
    "PST": 0,  # pregunta sobre la tarea (audio PC)
    "PFT": 0   # pregunta fuera de la tarea (audio PC)
}

# Directorios de audio (relativos al script)
AUDIO_DIR_PRINCIPITO = os.path.join(BASE_DIR, "audios_principito")

AUDIO_DIR_PST = os.path.join(AUDIO_DIR_PRINCIPITO, "PST")
N_AUDIO_FILES_PST = 3

AUDIO_DIR_PFT = os.path.join(AUDIO_DIR_PRINCIPITO, "PFT")
N_AUDIO_FILES_PFT = 6

# Sonidos especiales de inicio/fin de bloque/sesión
START_SOUND_PATH = os.path.join(AUDIO_DIR_PRINCIPITO, "inicio.mp3")
END_SOUND_PATH = os.path.join(AUDIO_DIR_PRINCIPITO, "fin_bloque.mp3")
END_SESSION_SOUND_PATH = os.path.join(AUDIO_DIR_PRINCIPITO, "fin_sesion.mp3")  # sonido final de sesión

# Carpeta raíz para sesiones
SESSIONS_ROOT = os.path.join(BASE_DIR, "Sesiones")  # siempre junto a lector.py

# ---- Modo de prueba rápido (opcional) ----
DEBUG_FAST = False
if DEBUG_FAST:
    INTERVALO_MIN = 3
    INTERVALO_MAX = 5
    MINUTES_PER_BLOCK = 0.3  # ~18 s/bloque
    REST_BETWEEN_BLOCKS_S = 5
# ------------------------------------------

# ============================================================
# ESTÍMULOS VISUALES (GIFs)
# ============================================================
GIF_DIR = os.path.join(BASE_DIR, "gifs_visuales")

# Dos GIFs para los estímulos visuales tipo V
GIF_V_PATHS = [
    os.path.join(GIF_DIR, "v1.gif"),
    os.path.join(GIF_DIR, "v2.gif"),
]

# Pool para usar cada GIF V a lo más una vez (sin repetición)
GIF_V_POOL = GIF_V_PATHS.copy()

def get_next_gif_v():
    """
    Devuelve la ruta de un GIF de GIF_V_PATHS sin repetir
    hasta agotar la lista. Cuando se vacía, ya no devuelve más.
    """
    global GIF_V_POOL
    # Nos quedamos solo con los que realmente existen
    GIF_V_POOL = [p for p in GIF_V_POOL if os.path.isfile(p)]
    if not GIF_V_POOL:
        return None
    random.shuffle(GIF_V_POOL)
    return GIF_V_POOL.pop()

def mostrar_gif_topmost(path, duracion_s=3.0):
    """
    Muestra un GIF en una ventana sin bordes, siempre al frente,
    durante 'duracion_s' segundos. Bloquea mientras el estímulo está en pantalla.
    """
    if not os.path.isfile(path):
        print(f"[GIF] Archivo no encontrado: {path}")
        return

    root = tk.Tk()
    root.overrideredirect(True)         # sin bordes
    root.attributes("-topmost", True)   # siempre al frente
    root.configure(background="black")

    # Cargar frames del GIF
    img = Image.open(path)
    frames = []
    durations = []

    try:
        while True:
            frames.append(ImageTk.PhotoImage(img.copy()))
            dur = img.info.get("duration", 50)  # ms
            durations.append(dur)
            img.seek(len(frames))  # siguiente frame
    except EOFError:
        pass

    if not frames:
        root.destroy()
        print(f"[GIF] No se pudieron leer frames del GIF: {path}")
        return

    # Centrar la ventana
    w = frames[0].width()
    h = frames[0].height()
    screen_w = root.winfo_screenwidth()
    screen_h = root.winfo_screenheight()
    x = (screen_w - w) // 2
    y = (screen_h - h) // 2
    root.geometry(f"{w}x{h}+{x}+{y}")

    label = tk.Label(root, bg="black")
    label.pack()

    start_time = time.time()
    total_ms = duracion_s * 1000.0

    def actualizar_frame(i=0):
        elapsed_ms = (time.time() - start_time) * 1000.0
        if elapsed_ms >= total_ms:
            root.destroy()
            return

        frame = frames[i % len(frames)]
        label.configure(image=frame)

        frame_duration = durations[i % len(durations)]
        if frame_duration <= 0:
            frame_duration = 50

        root.after(frame_duration, actualizar_frame, (i + 1))

    root.after(0, actualizar_frame)
    root.mainloop()

def disparar_estimulo_visual(block_idx, block_type, logger):
    """
    Elige uno de los GIFs definidos en GIF_V_PATHS (usando un pool sin repetición)
    y lo muestra durante 3 s. Devuelve True si se mostró un GIF, False si no.
    """
    path = get_next_gif_v()
    if not path:
        print(f"[GIF] No quedan GIFs V disponibles (o no se encontraron en {GIF_DIR}).")
        logger.log(datetime.now().isoformat(), block_idx, block_type,
                   "visual_stim_failed", "no_gifs_available")
        return False

    print(f"[{datetime.now().strftime('%H:%M:%S')}] -> ESTÍMULO VISUAL (V): {os.path.basename(path)}")
    logger.log(datetime.now().isoformat(), block_idx, block_type,
               "visual_stim", f"V:{os.path.basename(path)}")

    mostrar_gif_topmost(path, duracion_s=3.0)
    return True

# ============================================================
# CONFIG GAZEPOINT GP3
# ============================================================
GAZE_HOST = os.environ.get("GP3_HOST", "127.0.0.1")
GAZE_PORT = int(os.environ.get("GP3_PORT", "4242"))

GAZE_FIELDS = [
    "time_gp3", "time_tick",
    "bpogx", "bpogy", "bpogv",
    "fpogx", "fpogy", "fpogs", "fpogd", "fpogid", "fpogv",
    "lpogx", "lpogy", "lpv",
    "rpogx", "rpogy", "rpv",
    "lpcx", "lpcy", "lpd", "lps",
    "rpcx", "rpcy", "rpd", "rps",
]

GAZE_MAP = {
    "time_gp3": "TIME",
    "time_tick": "TICK",
    "bpogx": "BPOGX",
    "bpogy": "BPOGY",
    "bpogv": "BPOGV",
    "fpogx": "FPOGX",
    "fpogy": "FPOGY",
    "fpogs": "FPOGS",
    "fpogd": "FPOGD",
    "fpogid": "FPOGID",
    "fpogv": "FPOGV",
    "lpogx": "LPOGX",
    "lpogy": "LPOGY",
    "lpv": "LPOGV",
    "rpogx": "RPOGX",
    "rpogy": "RPOGY",
    "rpv": "RPOGV",
    "lpcx": "LPCX",
    "lpcy": "LPCY",
    "lpd": "LPD",
    "lps": "LPS",
    "rpcx": "RPCX",
    "rpcy": "RPCY",
    "rpd": "RPD",
    "rps": "RPS",
}

# ============================================================
# Utilidades de sesión (S1, S2, ... )
# ============================================================
def get_next_session_dir(root="Sesiones"):
    """
    Crea (si no existe) la carpeta 'Sesiones' y dentro una subcarpeta S# nueva.
    Devuelve (session_dir, session_name, session_number).
    """
    os.makedirs(root, exist_ok=True)
    max_n = 0
    for name in os.listdir(root):
        p = os.path.join(root, name)
        if os.path.isdir(p) and name.startswith("S"):
            try:
                n = int(name[1:])
                if n > max_n:
                    max_n = n
            except ValueError:
                pass
    next_n = max_n + 1 if max_n >= 1 else 1
    session_name = f"S{next_n}"
    session_dir = os.path.join(root, session_name)
    os.makedirs(session_dir, exist_ok=False)
    return session_dir, session_name, next_n

# ============================================================
# Logger CSV asíncrono (tiempo real) para eventos
# ============================================================
class CsvLogger:
    def __init__(self, path, header=None):
        self.path = path
        self.header = header or []
        self.q = queue.Queue()
        self._stop = threading.Event()
        self._th = None
        self._file = None
        self._writer = None

    def start(self):
        new_file = not os.path.exists(self.path)
        # buffering=1 -> line buffered (texto)
        self._file = open(self.path, "a", newline="", encoding="utf-8", buffering=1)
        self._writer = csv.writer(self._file)
        if new_file and self.header:
            self._writer.writerow(self.header)
            self._file.flush()
            try:
                os.fsync(self._file.fileno())
            except Exception:
                pass

        def _worker():
            # Podemos fijar afinidad aquí si quieres dedicar núcleos específicos al logger
            while not self._stop.is_set():
                try:
                    row = self.q.get(timeout=0.2)
                except queue.Empty:
                    continue
                try:
                    self._writer.writerow(row)
                    self._file.flush()
                    try:
                        os.fsync(self._file.fileno())  # fuerza a disco
                    except Exception:
                        pass
                except Exception as e:
                    print(f"[LOGGER] Error escribiendo CSV: {e}", file=sys.stderr)
                finally:
                    try:
                        self.q.task_done()
                    except Exception:
                        pass

        self._th = threading.Thread(target=_worker, daemon=True)
        self._th.start()

    def log(self, *cols):
        self.q.put(cols)

    def close(self):
        # Espera a que se vacíe la cola
        try:
            self.q.join()
        except Exception:
            pass
        self._stop.set()
        if self._th:
            self._th.join(timeout=0.5)
        if self._file:
            try:
                self._file.flush()
                try:
                    os.fsync(self._file.fileno())
                except Exception:
                    pass
                self._file.close()
            except Exception:
                pass

# ============================================================
# VideoRecorder: graba por bloques (con verificación simple de tamaño)
# ============================================================
def choose_camera_index():
    """
    Intenta usar primero la cámara USB (1) y,
    si no está disponible, la integrada (0).
    """
    if not CV2_OK:
        return None
    preferred = [1, 0]
    for idx in preferred:
        cap = cv2.VideoCapture(idx)
        if cap is not None and cap.isOpened():
            cap.release()
            print(f"[VIDEO] Usando cámara índice {idx}")
            return idx
        if cap is not None:
            cap.release()
    print("[VIDEO] No se encontró cámara disponible.")
    return None


class VideoRecorder:
    """
    Hilo que lee la cámara continuamente, pero solo
    escribe a disco cuando recording=True.
    Se crea un archivo por bloque.

    Incluye:
    - current_path: ruta del archivo de video actual.
    - verify_recording(): verifica que el archivo supere cierto tamaño.
    - start_block_with_check(): intenta varias veces hasta
      que el archivo sea mayor a un umbral (p.ej. > 2 KB);
      si no, reinicia la cámara.
    """
    def __init__(self, cam_index, session_dir, session_name, fps=30.0, cpu_cores=None):
        self.cam_index = cam_index
        self.session_dir = session_dir
        self.session_name = session_name
        self.fps = float(fps)

        self._stop = threading.Event()
        self._th = None

        self.cap = None
        self.writer = None
        self.recording = False
        self.frame_size = None

        self.current_block = None
        self.current_block_type = None
        self.current_path = None   # ruta del archivo de video en curso

        # Afinidad de CPU para el hilo de video
        self.cpu_cores = cpu_cores or []
        self._affinity_set = False

    def _open_camera(self):
        if self.cap is None:
            self.cap = cv2.VideoCapture(self.cam_index)

            if not self.cap.isOpened():
                print(f"[VIDEO] No se pudo abrir la cámara {self.cam_index}")
                if self.cap is not None:
                    self.cap.release()
                self.cap = None
                return False

            # Pedimos 1920x1080 (pero luego usamos lo que realmente quede)
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)

            # Leer resolución real
            w = int(self.cap.get(cv2.CROP_ORIENTED_VIDEO) if hasattr(cv2, "CROP_ORIENTED_VIDEO") else self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            if w <= 0 or h <= 0:
                # Fallback razonable
                w, h = 1280, 720
            self.frame_size = (w, h)
            print(f"[VIDEO] Cámara abierta con resolución {w}x{h}")

        return True

    def start(self):
        if not self._open_camera():
            return
        if self._th is not None:
            return

        def _loop():
            # Afinidad de CPU del hilo de video
            if self.cpu_cores and not self._affinity_set:
                CPU_AFFINITY.set_for_current_thread(self.cpu_cores)
                self._affinity_set = True

            last_time = time.time()
            fail_count = 0

            while not self._stop.is_set():
                if self.cap is None:
                    if not self._open_camera():
                        time.sleep(0.5)
                        continue

                ret, frame = self.cap.read()
                if not ret:
                    fail_count += 1
                    if fail_count > 50:
                        print("[VIDEO] Muchos fallos seguidos leyendo de la cámara. Reintentando abrir...")
                        try:
                            self.cap.release()
                        except Exception:
                            pass
                        self.cap = None
                        fail_count = 0
                    time.sleep(0.05)
                    continue
                fail_count = 0

                # Asegurar tamaño coherente
                h, w = frame.shape[:2]
                if self.frame_size is None:
                    self.frame_size = (w, h)
                    print(f"[VIDEO] Tamaño de frame detectado: {w}x{h}")
                elif (w, h) != self.frame_size:
                    frame = cv2.resize(frame, self.frame_size)

                if self.recording and self.writer is not None:
                    self.writer.write(frame)

                # limitar FPS (aprox.)
                elapsed = time.time() - last_time
                delay = max(0, (1.0 / self.fps) - elapsed)
                if delay > 0:
                    time.sleep(delay)
                last_time = time.time()

        self._th = threading.Thread(target=_loop, daemon=True)
        self._th.start()

    def start_block(self, block_idx, block_type):
        """Inicia un archivo de video para un bloque concreto."""
        if self.cap is None and not self._open_camera():
            return

        # Aseguramos la resolución actual
        w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        if w <= 0 or h <= 0:
            w, h = self.frame_size if self.frame_size is not None else (1280, 720)
        self.frame_size = (w, h)

        # Obtener FPS real de la cámara si está disponible
        fps_cam = self.cap.get(cv2.CAP_PROP_FPS)
        if fps_cam and fps_cam > 1 and fps_cam < 240:
            self.fps = float(fps_cam)

        print(f"[VIDEO] FPS usados para el bloque {block_idx+1}: {self.fps}")
        print(f"[VIDEO] Resolución usada para el bloque {block_idx+1}: {self.frame_size[0]}x{self.frame_size[1]}")

        # Cierra escritor previo si quedara alguno
        if self.writer is not None:
            try:
                self.writer.release()
            except Exception:
                pass
            self.writer = None

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        filename = f"{self.session_name}_B{block_idx+1}_{block_type}.mp4"
        path = os.path.join(self.session_dir, filename)
        self.current_path = path  # guardamos la ruta del archivo

        self.writer = cv2.VideoWriter(path, fourcc, self.fps, self.frame_size)
        if not self.writer.isOpened():
            print(f"[VIDEO] No se pudo crear el archivo de video: {path}")
            try:
                self.writer.release()
            except Exception:
                pass
            self.writer = None
            self.recording = False
            return

        self.current_block = block_idx
        self.current_block_type = block_type
        self.recording = True
        print(f"[VIDEO] Grabando bloque {block_idx+1} ({block_type}) en: {path}")

    def verify_recording(self, timeout=3.0, min_size_bytes=2048):
        """
        Verifica durante 'timeout' segundos que el archivo de video actual
        (self.current_path) supere un tamaño mínimo (p.ej. > 2 KB).
        NO busca crecimiento relativo, solo que pase del umbral absoluto.
        Devuelve True si lo logra, False en caso contrario.
        """
        if not self.current_path or self.writer is None or not self.recording:
            print("[VIDEO] verify_recording: no hay writer o current_path.")
            return False

        start_t = time.time()
        last_size = 0

        while time.time() - start_t < timeout:
            try:
                size = os.path.getsize(self.current_path)
            except OSError:
                size = 0

            last_size = size

            # Si el archivo es mayor que el umbral, lo damos por bueno
            if size > min_size_bytes:
                print(f"[VIDEO] Archivo de video válido: {size} bytes (> {min_size_bytes}).")
                return True

            time.sleep(0.3)

        print(f"[VIDEO] Archivo de video no superó {min_size_bytes} bytes en {timeout} s (último tamaño {last_size} bytes).")
        return False

    def start_block_with_check(self, block_idx, block_type, logger,
                               max_retries=3, check_seconds=3.0, min_size_bytes=2048):
        """
        Inicia la grabación de un bloque y verifica rápidamente que el archivo
        supere 'min_size_bytes'. Si no lo logra dentro de 'check_seconds',
        reinicia cámara y escritor y reintenta hasta 'max_retries' veces.

        Regresa True si la verificación fue exitosa, False en caso contrario.

        Registra:
          - video_start (únicamente cuando la verificación es correcta)
          - video_error (cuando hay problemas)
        """
        for attempt in range(1, max_retries + 1):
            print(f"[VIDEO] Iniciando bloque {block_idx+1} ({block_type}), intento {attempt}...")
            self.start_block(block_idx, block_type)

            if self.verify_recording(timeout=check_seconds, min_size_bytes=min_size_bytes):
                logger.log(datetime.now().isoformat(), block_idx, block_type,
                           "video_start", f"{block_type}_block (attempt={attempt})")
                print(f"[VIDEO] Grabación de bloque {block_idx+1} verificada correctamente.")
                return True

            # Si llegamos aquí, el archivo nunca pasó del umbral en este intento
            print(f"[VIDEO] No se detectó tamaño suficiente del archivo de video en el intento {attempt}. Reiniciando cámara...")
            logger.log(datetime.now().isoformat(), block_idx, block_type,
                       "video_error", f"no_min_size_attempt_{attempt}")

            self.recording = False
            if self.writer is not None:
                try:
                    self.writer.release()
                except Exception:
                    pass
                self.writer = None

            self.current_block = None
            self.current_block_type = None

            if self.cap is not None:
                try:
                    self.cap.release()
                except Exception:
                    pass
                self.cap = None

            time.sleep(1.0)  # pequeña pausa antes de reintentar

        print(f"[VIDEO] No se pudo iniciar correctamente la grabación de video para el bloque {block_idx+1} tras {max_retries} intentos.")
        logger.log(datetime.now().isoformat(), block_idx, block_type,
                   "video_error", "failed_after_retries")
        return False

    def stop_block(self):
        """Detiene la grabación del bloque actual (pero deja la cámara lista)."""
        self.recording = False
        if self.writer is not None:
            try:
                self.writer.release()
            except Exception:
                pass
            print(f"[VIDEO] Fin bloque {(self.current_block or 0) + 1} ({self.current_block_type})")
            self.writer = None
        self.current_block = None
        self.current_block_type = None
        # mantenemos current_path (archivo ya grabado)

    def close(self):
        """Detiene todo (hilo, cámara, escritor)."""
        self.recording = False
        self._stop.set()
        if self._th:
            self._th.join(timeout=0.5)
        if self.writer is not None:
            try:
                self.writer.release()
            except Exception:
                pass
            self.writer = None
        if self.cap is not None:
            try:
                self.cap.release()
            except Exception:
                pass
            self.cap = None

# ============================================================
# AudioRecorder: graba audio (micrófono / webcam) por bloques
# ============================================================
class AudioRecorder:
    """
    Graba audio del dispositivo de entrada por bloques.
    Crea un archivo WAV por bloque con nombre:
      S#_B{n}_{stim|free}.wav
    Usa el dispositivo de entrada por defecto del sistema.
    Además, puede inyectar en la grabación los audios de estímulo (PST/PFT)
    a partir de los archivos de sonido.
    """
    def __init__(self, session_dir, session_name, samplerate=44100, channels=1):
        self.session_dir = session_dir
        self.session_name = session_name
        self.samplerate = samplerate
        self.channels = channels

        self._stream = None
        self._file = None

        self.current_block = None
        self.current_block_type = None

        # --- buffer de estímulos a mezclar ---
        self._stim_lock = threading.Lock()
        self._stim_buffer = None   # np.array [N, channels] float32 (cola de estímulos pendientes)

    def _callback(self, indata, frames, time_info, status):
        if status:
            print(f"[AUDIO] {status}", file=sys.stderr)
        if self._file is not None:
            # Nos aseguramos de trabajar en float32
            audio = indata.astype(np.float32, copy=True)

            # Mezclar estímulos, si hay
            with self._stim_lock:
                if self._stim_buffer is not None and len(self._stim_buffer) > 0:
                    n = min(len(self._stim_buffer), frames)
                    # sumamos sólo sobre la parte que existe
                    audio[:n, :] += self._stim_buffer[:n, :]
                    # consumimos del buffer
                    if n < len(self._stim_buffer):
                        self._stim_buffer = self._stim_buffer[n:, :]
                    else:
                        self._stim_buffer = None

            # soundfile se encarga de convertir a PCM_16
            self._file.write(audio)

    def start_block(self, block_idx, block_type):
        if not AUDIO_OK:
            print("[AUDIO] No se grabará audio (dependencias no disponibles).")
            return

        # Por seguridad, detener bloque previo si existiera
        if self._stream is not None or self._file is not None:
            self.stop_block()

        filename = f"{self.session_name}_B{block_idx+1}_{block_type}.wav"
        path = os.path.join(self.session_dir, filename)

        try:
            self._file = sf.SoundFile(
                path,
                mode="w",
                samplerate=self.samplerate,
                channels=self.channels,
                subtype="PCM_16"
            )
            # IMPORTANTE: dtype float32 para que la mezcla sea coherente
            self._stream = sd.InputStream(
                samplerate=self.samplerate,
                channels=self.channels,
                callback=self._callback,
                dtype="float32",
            )
            self._stream.start()
            self.current_block = block_idx
            self.current_block_type = block_type

            # Reiniciar cola de estímulos para este bloque
            with self._stim_lock:
                self._stim_buffer = None

            print(f"[AUDIO] Grabando audio bloque {block_idx+1} ({block_type}) en: {path}")
        except Exception as e:
            print(f"[AUDIO] Error iniciando grabación de audio: {e}")
            self._stream = None
            if self._file is not None:
                try:
                    self._file.close()
                except Exception:
                    pass
                self._file = None

    def stop_block(self):
        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            except Exception:
                pass
            self._stream = None
        if self._file is not None:
            try:
                self._file.close()
            except Exception:
                pass
            print(f"[AUDIO] Fin audio bloque {(self.current_block or 0)+1} ({self.current_block_type})")
            self._file = None
        self.current_block = None
        self.current_block_type = None

        # Limpiar buffer de estímulos
        with self._stim_lock:
            self._stim_buffer = None

    def close(self):
        self.stop_block()

    # ---------- añadir estímulo a la grabación ----------
    def add_stimulus_from_file(self, path):
        """
        Carga un archivo de audio (mp3, wav, etc. si soundfile lo soporta)
        y lo encola para mezclarlo en la grabación a partir del momento actual.
        """
        try:
            data, sr = sf.read(path, dtype="float32")
        except Exception as e:
            print(f"[AUDIO] No se pudo leer el estímulo para mezclarlo en la grabación ({path}): {e}")
            return

        if sr != self.samplerate:
            print(f"[AUDIO] WARNING: samplerate estímulo {sr} != {self.samplerate}. Se omite mezcla.")
            return

        # data puede ser [N] o [N, C]
        if data.ndim == 1:
            # mono -> repetir en todos los canales
            data = np.repeat(data[:, np.newaxis], self.channels, axis=1)
        elif data.shape[1] != self.channels:
            # Ajustar número de canales de forma simple
            if data.shape[1] > self.channels:
                data = data[:, :self.channels]
            else:
                # Menos canales que la grabación: rellenar con ceros
                extra = self.channels - data.shape[1]
                data = np.concatenate([data, np.zeros((data.shape[0], extra), dtype=np.float32)], axis=1)

        with self._stim_lock:
            if self._stim_buffer is None:
                self._stim_buffer = data
            else:
                self._stim_buffer = np.concatenate([self._stim_buffer, data], axis=0)

        print(f"[AUDIO] Estímulo encolado para mezcla en grabación: {os.path.basename(path)}")

# ============================================================
# Utilidades audio (reproducción estímulos)
# ============================================================
# Pools de IDs de audio para evitar repeticiones
AUDIO_POOL_TEMPLATE = {
    "PST": list(range(1, N_AUDIO_FILES_PST + 1)),   # [1, 2, 3]
    "PFT": list(range(1, N_AUDIO_FILES_PFT + 1)),   # [1, 2, 3, 4, 5, 6]
}

# Estado mutable: lo iremos vaciando conforme se usen los audios
AUDIO_POOL = {
    "PST": [],
    "PFT": [],
}

def get_next_audio_index(tipo):
    """
    Devuelve un índice de audio para 'PST' o 'PFT' sin repetir
    hasta agotar la lista. Cuando se agota, se vuelve a recargar
    el pool completo (útil si hay PFT extra, por ejemplo).
    """
    if tipo not in AUDIO_POOL_TEMPLATE:
        return None

    pool = AUDIO_POOL[tipo]

    # Si ya nos gastamos todos, recargamos el pool
    if not pool:
        pool[:] = AUDIO_POOL_TEMPLATE[tipo][:]
        random.shuffle(pool)  # orden aleatorio

    # Sacamos uno del pool (sin repetición hasta vaciarlo)
    return pool.pop()

def init_audio():
    """Inicializa pygame mixer si hace falta."""
    if not PYGAME_OK:
        return
    if not pygame.get_init():
        pygame.mixer.init()
        pygame.init()

def reproducir_pregunta(tipo, audiorec=None):
    """
    Reproduce un mp3 según 'tipo' (PST o PFT) usando un pool sin repetición.
    Cuando se agotan los audios de ese tipo, se recarga el pool
    y se puede volver a repetir, pero solo después de haber pasado por todos.
    Retorna una etiqueta útil para el log, p.ej. 'PST:2'.

    Si audiorec no es None, también inyecta el audio del estímulo
    en la grabación de audio del bloque actual.
    """
    if not PYGAME_OK:
        print("[WARN] pygame no está disponible; se omite reproducción.")
        return f"{tipo}:no_pygame"

    init_audio()

    if tipo == "PST":
        base = AUDIO_DIR_PST
    elif tipo == "PFT":
        base = AUDIO_DIR_PFT
    else:
        print(f"[WARN] Tipo de pregunta desconocido: {tipo}")
        return f"{tipo}:unknown"

    idx = get_next_audio_index(tipo)
    if idx is None:
        print(f"[WARN] No se pudo obtener índice de audio para tipo {tipo}")
        return f"{tipo}:no_index"

    path = os.path.join(base, f"{idx}.mp3")
    if not os.path.isfile(path):
        print(f"[WARN] Falta audio: {path}")
        return f"{tipo}:{idx} (missing)"

    # Encolar el estímulo en la grabación de audio
    if audiorec is not None:
        try:
            audiorec.add_stimulus_from_file(path)
        except Exception as e:
            print(f"[AUDIO] Error al inyectar estímulo en grabación: {e}")

    print(f"[{datetime.now().strftime('%H:%M:%S')}] -> {tipo} reproduce: {os.path.basename(path)}")
    try:
        pygame.mixer.music.load(path)
        pygame.mixer.music.play()
        while pygame.mixer.music.get_busy():
            time.sleep(0.1)
        return f"{tipo}:{idx}"
    except Exception as e:
        print(f"[ERROR] Reproducción falló: {e}")
        return f"{tipo}:{idx} (error)"

def reproducir_sonido_inicio():
    """
    Reproduce el sonido de inicio de la prueba (START_SOUND_PATH).
    Se usa solo una vez, antes de comenzar la captura.
    """
    if not PYGAME_OK:
        print("[WARN] pygame no está disponible; no se reproduce sonido de inicio.")
        return

    init_audio()

    if not os.path.isfile(START_SOUND_PATH):
        print(f"[WARN] Sonido de inicio no encontrado: {START_SOUND_PATH}")
        return

    print(f"[{datetime.now().strftime('%H:%M:%S')}] -> SONIDO DE INICIO: {os.path.basename(START_SOUND_PATH)}")
    try:
        pygame.mixer.music.load(START_SOUND_PATH)
        pygame.mixer.music.play()
        while pygame.mixer.music.get_busy():
            time.sleep(0.1)
    except Exception as e:
        print(f"[ERROR] Reproducción de sonido de inicio falló: {e}")

def reproducir_sonido_fin_bloque():
    """
    Reproduce el sonido de fin de bloque (END_SOUND_PATH).
    Se usa al terminar cada bloque (stim o libre).
    """
    if not PYGAME_OK:
        print("[WARN] pygame no está disponible; no se reproduce sonido de fin de bloque.")
        return

    init_audio()

    if not os.path.isfile(END_SOUND_PATH):
        print(f"[WARN] Sonido de fin de bloque no encontrado: {END_SOUND_PATH}")
        return

    print(f"[{datetime.now().strftime('%H:%M:%S')}] -> SONIDO FIN BLOQUE: {os.path.basename(END_SOUND_PATH)}")
    try:
        pygame.mixer.music.load(END_SOUND_PATH)
        pygame.mixer.music.play()
        while pygame.mixer.music.get_busy():
            time.sleep(0.1)
    except Exception as e:
        print(f"[ERROR] Reproducción de sonido de fin de bloque falló: {e}")

def reproducir_sonido_fin_sesion():
    """
    Reproduce el sonido final de sesión (END_SESSION_SOUND_PATH).
    Se usa solo al terminar el último bloque.
    """
    if not PYGAME_OK:
        print("[WARN] pygame no está disponible; no se reproduce sonido de fin de sesión.")
        return

    init_audio()

    if not os.path.isfile(END_SESSION_SOUND_PATH):
        print(f"[WARN] Sonido de fin de sesión no encontrado: {END_SESSION_SOUND_PATH}")
        return

    print(f"[{datetime.now().strftime('%H:%M:%S')}] -> SONIDO FIN SESIÓN: {os.path.basename(END_SESSION_SOUND_PATH)}")
    try:
        pygame.mixer.music.load(END_SESSION_SOUND_PATH)
        pygame.mixer.music.play()
        while pygame.mixer.music.get_busy():
            time.sleep(0.1)
    except Exception as e:
        print(f"[ERROR] Reproducción de sonido de fin de sesión falló: {e}")

# ============================================================
# Utilidades serial / planificación
# ============================================================
def enviar_estimulo_serial(ser, tipo, dur):
    """Envía 'K 1.50' o 'A 2.00' al micro."""
    cmd = f"{tipo} {dur:.2f}\n"
    ser.write(cmd.encode())
    print(f"[{datetime.now().strftime('%H:%M:%S')}] -> Enviado: {cmd.strip()}")
    return cmd.strip()

def min_eventos_restantes(t_rest_actual_s, bloques_restantes, minutos_por_bloque):
    """
    t_rest_actual_s: segundos que le quedan al bloque actual
    bloques_restantes: cuántos bloques de estimulación quedan después del actual
    minutos_por_bloque: duración de cada bloque (en minutos)

    Devuelve una cota inferior del número de eventos que aún caben
    asumiendo INTERVALO_MAX de aquí en adelante.
    """
    ev_min_actual = int(max(0.0, t_rest_actual_s) // INTERVALO_MAX)
    ev_min_futuros = bloques_restantes * int((minutos_por_bloque * 60) // INTERVALO_MAX)
    return ev_min_actual + ev_min_futuros


def elegir_tipo_multicupo(quotas_rest, ev_min_rest):
    """
    Selecciona tipo cumpliendo cupos múltiples:
      - Si no hay cupos -> None
      - Si sum(cupos) > ev_min_rest -> forzar el tipo con mayor restante
      - Si no, elegir proporcional al restante
    """
    activos = {k: v for k, v in quotas_rest.items() if v > 0}
    if not activos:
        return None
    total_rest = sum(activos.values())
    if total_rest > ev_min_rest:
        max_rest = max(activos.values())
        candidatos = [k for k, v in activos.items() if v == max_rest]
        return random.choice(candidatos)
    tipos = list(activos.keys())
    pesos = [activos[t] for t in tipos]
    return random.choices(tipos, weights=pesos, k=1)[0]

# ============================================================
# Hilo lector (serial)
# ============================================================
def hilo_lector(ser, state, logger):
    """
    Lee el puerto serie y:
      - Imprime ACKs / mensajes del micro
      - Si detecta '1' exacto -> Autorreporte (usa state['current_block'])
    NO registra nada en CSV durante los descansos (state['in_rest'] == True).
    """
    while True:
        try:
            line = ser.readline().decode(errors='ignore').strip()
            if not line:
                continue
            now = datetime.now().strftime('%H:%M:%S')
            with state["lock"]:
                bidx = state["current_block"]
                btype = "stim" if bidx in state["stim_set"] else "free"
                in_rest = state.get("in_rest", False)

            # Si estamos en descanso, se imprime pero NO se guarda en CSV
            if in_rest:
                print(f"[{now}] (descanso) <- {line}")
                continue

            if line == "1":
                print(f"[{now}] <- AUTORREPORTE (1) | bloque={bidx+1} ({btype})")
                logger.log(datetime.now().isoformat(), bidx, btype, "self_report", "1")
            else:
                print(f"[{now}] <- {line}")
                logger.log(datetime.now().isoformat(), bidx, btype, "serial_msg", line)
        except Exception:
            # no tumbar el hilo por errores transitorios
            pass

# ============================================================
# Bloques: estimulación y lectura libre
# ============================================================
def ejecutar_bloque_estimulos(ser, idx_bloque, minutos, estado, logger, vidrec=None, audiorec=None):
    """
    Bloque con V/K/A/PST/PFT.
    Usa cupos globales en estado['quotas_rest'].
    Si todos los cupos llegan a 0, añade UNA vez un PFT extra.
    Devuelve True si ya no queda ningún cupo (tras posible PFT extra).

    AHORA:
    - El tiempo del bloque se controla con time.perf_counter() pero
      se inicia DESPUÉS de verificar que el video esté grabando bien.
    - Los estímulos no inician hasta que la captura de video esté correcta
      (o se haya decidido seguir sin video tras varios intentos).
    - El evento "start" en el CSV se registra solo después de esa verificación.
    """
    inicio_dt = datetime.now()
    duracion_bloque_s = minutos * 60.0

    with estado["lock"]:
        estado["current_block"] = idx_bloque
        estado["in_rest"] = False

    print(f"\n=== BLOQUE {idx_bloque+1}/{estado['total_bloques']} (ESTÍMULOS) "
          f"INICIA {inicio_dt.strftime('%H:%M:%S')} ({minutos} min) ===")
    print(f"    Cupos al inicio: {estado['quotas_rest']} "
          f"(extra_pft_added={estado.get('extra_pft_added', False)})")

    # Inicia video para este bloque (si hay cámara) con verificación de tamaño
    if vidrec is not None:
        video_ok = vidrec.start_block_with_check(idx_bloque, "stim", logger,
                                                 max_retries=3,
                                                 check_seconds=3.0,
                                                 min_size_bytes=2048)
    else:
        video_ok = False

    # Inicia audio para este bloque
    if audiorec is not None:
        audiorec.start_block(idx_bloque, "stim")
        logger.log(datetime.now().isoformat(), idx_bloque, "stim", "audio_start", "stim_block")

    # Registrar inicio de bloque SOLO después de la verificación de video
    logger.log(datetime.now().isoformat(), idx_bloque, "stim", "start",
               "video_ok" if video_ok else "video_not_available_or_failed")

    # Timer monotónico del bloque, después de que todo está listo
    t0 = time.perf_counter()

    while True:
        # Tiempo transcurrido y restante del bloque (en segundos) según timer monotónico
        now_mono = time.perf_counter()
        elapsed_s = now_mono - t0
        t_rest_actual_s = duracion_bloque_s - elapsed_s

        if t_rest_actual_s <= 0:
            # se acabó el bloque
            break

        # ¿Se cumplieron todos los cupos?
        total_rest = sum(max(0, v) for v in estado['quotas_rest'].values())
        if total_rest == 0:
            # Si ya no hay cupos, ver si ya agregamos un PFT extra
            if not estado.get("extra_pft_added", False):
                # Agregamos un PFT extra UNA SOLA VEZ
                estado['quotas_rest']["PFT"] = estado['quotas_rest'].get("PFT", 0) + 1
                estado["extra_pft_added"] = True
                print(">>> Todos los cupos se agotaron: se añade UN PFT extra.")
                print(f"    Cupos ahora: {estado['quotas_rest']}")
                logger.log(datetime.now().isoformat(), idx_bloque, "stim",
                           "add_extra_pft", str(estado['quotas_rest']))
                # volvemos al while para que se dispare ese PFT extra
                continue
            else:
                # Ya se añadió el PFT extra y tampoco queda nada:
                # solo esperamos que termine el bloque en tiempo
                print(">>> Cupos (incluyendo el PFT extra) ya se agotaron. Esperando fin de bloque.")
                # Esperar el tiempo restante según el timer del bloque
                if t_rest_actual_s > 0:
                    time.sleep(t_rest_actual_s)
                break

        # Elegir intervalo para el siguiente evento
        intervalo = random.uniform(INTERVALO_MIN, INTERVALO_MAX)

        # Si el intervalo excede el tiempo restante, ya no metemos otro evento
        if intervalo > t_rest_actual_s:
            # esperar lo que queda y terminar el bloque
            if t_rest_actual_s > 0:
                time.sleep(t_rest_actual_s)
            break

        # Esperar hasta el próximo evento
        time.sleep(intervalo)

        # Recalcular tiempo restante después de la espera
        now_mono = time.perf_counter()
        elapsed_s = now_mono - t0
        t_rest_actual_s = duracion_bloque_s - elapsed_s
        if t_rest_actual_s <= 0:
            break

        # Cálculo de eventos mínimos que caben aún
        ev_min_rest = min_eventos_restantes(
            t_rest_actual_s,
            bloques_restantes=estado['stim_blocks_left_after_current'],
            minutos_por_bloque=estado['minutos_por_bloque']
        )

        tipo = elegir_tipo_multicupo(estado['quotas_rest'], ev_min_rest)
        if tipo is None:
            # nada que disparar, volvemos a la iteración
            continue

        ahora_dt = datetime.now()
        did_stim = False  # bandera: solo bajamos cupo si realmente se disparó algo

        if tipo in ("K", "A"):
            dur = random.uniform(DURACION_MIN, DURACION_MAX)
            sent = enviar_estimulo_serial(ser, tipo, dur)
            logger.log(ahora_dt.isoformat(), idx_bloque, "stim", "send", sent)
            did_stim = True

        elif tipo == "V":
            # Estímulo visual (GIF en pantalla, sin repetición)
            shown = disparar_estimulo_visual(idx_bloque, "stim", logger)
            if shown:
                did_stim = True
            else:
                # No se pudo mostrar GIF (no hay más); pasamos al siguiente evento
                continue

        elif tipo in ("PST", "PFT"):
            tag = reproducir_pregunta(tipo, audiorec=audiorec)
            logger.log(ahora_dt.isoformat(), idx_bloque, "stim", "play_audio", tag)
            did_stim = True
        else:
            print(f"[WARN] Tipo desconocido: {tipo}")
            logger.log(ahora_dt.isoformat(), idx_bloque, "stim", "unknown_type", str(tipo))
            continue

        if did_stim:
            estado['quotas_rest'][tipo] -= 1
            print(f"    [cupo] Restantes: {estado['quotas_rest']}")
            logger.log(datetime.now().isoformat(), idx_bloque, "stim",
                       "quota_update", str(estado['quotas_rest']))

    # Señal de fin de bloque (audio + vibración distinta a la de inicio)
    print(f"[BLOQUE {idx_bloque+1}] Señal de FIN de bloque (audio + vibración)")
    reproducir_sonido_fin_bloque()
    try:
        # Por ejemplo, vibración más corta (1.0 s) para diferenciar de la preparación (2.0 s)
        end_cmd = enviar_estimulo_serial(ser, "K", 1.0)
        logger.log(datetime.now().isoformat(), idx_bloque, "stim",
                   "end_block_vibration", end_cmd)
    except Exception as e:
        print(f"[WARN] No se pudo enviar vibración de fin de bloque (stim): {e}")

    print(f"=== BLOQUE {idx_bloque+1} (ESTÍMULOS) "
          f"TERMINA {datetime.now().strftime('%H:%M:%S')} ===\n")
    logger.log(datetime.now().isoformat(), idx_bloque, "stim", "end", "")

    # Detener video del bloque
    if vidrec is not None:
        vidrec.stop_block()
        logger.log(datetime.now().isoformat(), idx_bloque, "stim", "video_end", "stim_block")

    # Detener audio del bloque
    if audiorec is not None:
        audiorec.stop_block()
        logger.log(datetime.now().isoformat(), idx_bloque, "stim", "audio_end", "stim_block")

    # Devuelve True si ya no queda ningún cupo (después de posible PFT extra)
    return sum(max(0, v) for v in estado['quotas_rest'].values()) == 0


def ejecutar_bloque_libre(ser, idx_bloque, minutos, estado, logger, vidrec=None, audiorec=None):
    """
    Bloque de lectura libre (sin V/K/A/PST/PFT).

    AHORA:
    - La verificación de video se hace antes de arrancar el temporizador.
    - El evento "start" se registra sólo después de esa verificación.
    """
    inicio_dt = datetime.now()
    duracion_bloque_s = minutos * 60.0

    with estado["lock"]:
        estado["current_block"] = idx_bloque
        estado["in_rest"] = False

    print(f"\n=== BLOQUE {idx_bloque+1}/{estado['total_bloques']} (LECTURA LIBRE) "
          f"INICIA {inicio_dt.strftime('%H:%M:%S')} ({minutos} min) ===")

    # Inicia video para bloque de lectura libre (con verificación)
    if vidrec is not None:
        video_ok = vidrec.start_block_with_check(idx_bloque, "free", logger,
                                                 max_retries=3,
                                                 check_seconds=3.0,
                                                 min_size_bytes=2048)
    else:
        video_ok = False

    # Inicia audio para bloque de lectura libre
    if audiorec is not None:
        audiorec.start_block(idx_bloque, "free")
        logger.log(datetime.now().isoformat(), idx_bloque, "free",
                   "audio_start", "free_block")

    # Registrar inicio de bloque SOLO después de la verificación de video
    logger.log(datetime.now().isoformat(), idx_bloque, "free", "start",
               "video_ok" if video_ok else "video_not_available_or_failed")

    # Timer del bloque (después de la verificación)
    t0 = time.perf_counter()

    while True:
        elapsed_s = time.perf_counter() - t0
        if elapsed_s >= duracion_bloque_s:
            break
        time.sleep(0.1)

    # Señal de fin de bloque libre (audio + vibración)
    print(f"[BLOQUE {idx_bloque+1}] Señal de FIN de bloque (lectura libre)")
    reproducir_sonido_fin_bloque()
    try:
        # Duración diferente para distinguirla (por ejemplo 1.5 s)
        end_cmd = enviar_estimulo_serial(ser, "K", 1.5)
        logger.log(datetime.now().isoformat(), idx_bloque, "free",
                   "end_block_vibration", end_cmd)
    except Exception as e:
        print(f"[WARN] No se pudo enviar vibración de fin de bloque (free): {e}")

    print(f"=== BLOQUE {idx_bloque+1} (LECTURA LIBRE) "
          f"TERMINA {datetime.now().strftime('%H:%M:%S')} ===\n")
    logger.log(datetime.now().isoformat(), idx_bloque, "free", "end", "")

    # Detener video también aquí
    if vidrec is not None:
        vidrec.stop_block()
        logger.log(datetime.now().isoformat(), idx_bloque, "free",
                   "video_end", "free_block")

    # Detener audio también aquí
    if audiorec is not None:
        audiorec.stop_block()
        logger.log(datetime.now().isoformat(), idx_bloque, "free",
                   "audio_end", "free_block")


# ============================================================
# GazeRecorder (GP3)
# ============================================================
class GazeRecorder:
    """
    Conecta al GP3, escucha <REC .../> y escribe un CSV dentro de la sesión
    SOLO cuando NO estamos en descanso (in_rest == False).
    """

    def __init__(self, session_dir, session_name, state, cpu_cores=None):
        self.session_dir = session_dir
        self.session_name = session_name
        self.state = state  # dict compartido: current_block, in_rest, stim_set, lock
        self.sock = None
        self.buffer = ""
        self.running = False
        self.thread = None
        self.csv_file = None
        self.csv_writer = None

        # Afinidad de CPU para el hilo de gaze
        self.cpu_cores = cpu_cores or []
        self._affinity_set = False

    # ---------- Conexión / control GP3 ----------
    def connect(self):
        deadline = time.time() + 60
        last_err = None
        print(f"[GP3] Conectando a {GAZE_HOST}:{GAZE_PORT}...")
        while time.time() < deadline:
            try:
                self.sock = socket.create_connection((GAZE_HOST, GAZE_PORT), timeout=3)
                self.sock.settimeout(1.0)
                self.running = True
                print("[GP3] Conectado.")
                return
            except Exception as e:
                last_err = e
                time.sleep(2)
        raise RuntimeError(
            f"No se pudo conectar al GP3 en {GAZE_HOST}:{GAZE_PORT}. "
            f"Último error: {last_err}"
        )

    def send(self, msg: str):
        if not msg.endswith("\r\n"):
            msg += "\r\n"
        try:
            self.sock.sendall(msg.encode("utf-8"))
        except Exception as e:
            print(f"[GP3] Error enviando comando '{msg.strip()}': {e}")

    def enable_streams(self):
        cmds = [
            # Tiempo / contador
            '<SET ID="ENABLE_SEND_TIME" STATE="1" />',
            '<SET ID="ENABLE_SEND_COUNTER" STATE="1" />',
            # Gaze
            '<SET ID="ENABLE_SEND_POG_BEST" STATE="1" />',
            '<SET ID="ENABLE_SEND_POG_LEFT" STATE="1" />',
            '<SET ID="ENABLE_SEND_POG_RIGHT" STATE="1" />',
            '<SET ID="ENABLE_SEND_FPOG" STATE="1" />',
            # Pupila imagen
            '<SET ID="ENABLE_SEND_PUPIL_LEFT" STATE="1" />',
            '<SET ID="ENABLE_SEND_PUPIL_RIGHT" STATE="1" />',
            # Ojo 3D
            '<SET ID="ENABLE_SEND_EYE_LEFT" STATE="1" />',
            '<SET ID="ENABLE_SEND_EYE_RIGHT" STATE="1" />',
        ]
        for c in cmds:
            self.send(c)
        self.send('<SET ID="ENABLE_SEND_DATA" STATE="1" />')
        print("[GP3] Streams habilitados y envío de datos activo.")

    # ---------- CSV ----------
    def _open_csv(self):
        path = os.path.join(self.session_dir, f"{self.session_name}_gaze.csv")
        self.csv_file = open(path, "w", newline="", encoding="utf-8")

        header = [
            "PC_TIMESTAMP",
            "block_idx",
            "block_type",
            "GAZE_VALID",
            "BPOG_ONSCREEN",
            # Datos de GP3
            "TIME",
            "BPOGX", "BPOGY", "BPOGV",
            "LPOGX", "LPOGY", "LPOGV",
            "RPOGX", "RPOGY", "RPOGV",
            "LPCX", "LPCY", "LPD", "LPS", "LPV",
            "RPCX", "RPCY", "RPD", "RPS", "RPV",
            "LEYEX", "LEYEY", "LEYEZ", "LPUPILD", "LPUPILV",
            "REYEX", "REYEY", "REYEZ", "RPUPILD", "RPUPILV",
            "CNT",
        ]
        self.csv_writer = csv.DictWriter(self.csv_file, fieldnames=header)
        self.csv_writer.writeheader()
        print(f"[GP3] CSV gaze: {path}")

    # ---------- Parsing REC ----------
    def _parse_rec(self, xml_line: str):
        try:
            elem = ET.fromstring(xml_line.strip())
            if elem.tag != "REC":
                return None
            return dict(elem.attrib)
        except ET.ParseError:
            return None

    def _to_float(self, x):
        try:
            return float(x)
        except Exception:
            return None

    def _build_row(self, rec_dict):
        row = {k: "" for k in self.csv_writer.fieldnames}

        # Marca de tiempo PC
        row["PC_TIMESTAMP"] = datetime.now().isoformat()

        # Info de bloque actual
        with self.state["lock"]:
            bidx = self.state.get("current_block", 0)
            stim_set = self.state.get("stim_set", set())
            btype = "stim" if bidx in stim_set else "free"
        row["block_idx"] = bidx
        row["block_type"] = btype

        direct_keys = [
            "TIME",
            "BPOGX", "BPOGY", "BPOGV",
            "LPOGX", "LPOGY", "LPOGV",
            "RPOGX", "RPOGY", "RPOGV",
            "LPCX", "LPCY", "LPD", "LPS", "LPV",
            "RPCX", "RPCY", "RPD", "RPS", "RPV",
            "LEYEX", "LEYEY", "LEYEZ", "LPUPILD", "LPUPILV",
            "REYEX", "REYEY", "REYEZ", "RPUPILD", "RPUPILV",
            "CNT",
        ]
        for k in direct_keys:
            if k in rec_dict:
                row[k] = rec_dict[k]

        # GAZE_VALID
        gaze_valid = (
            rec_dict.get("BPOGV") == "1" or
            rec_dict.get("LPOGV") == "1" or
            rec_dict.get("RPOGV") == "1"
        )
        row["GAZE_VALID"] = "1" if gaze_valid else "0"

        # BPOG_ONSCREEN
        bx = self._to_float(rec_dict.get("BPOGX"))
        by = self._to_float(rec_dict.get("BPOGY"))
        on_screen = (
            bx is not None and by is not None and
            0.0 <= bx <= 1.0 and 0.0 <= by <= 1.0
        )
        row["BPOG_ONSCREEN"] = "1" if on_screen else "0"

        return row

    # ---------- Loop principal ----------
    def _loop(self):
        # Afinidad de CPU para este hilo
        if self.cpu_cores and not self._affinity_set:
            CPU_AFFINITY.set_for_current_thread(self.cpu_cores)
            self._affinity_set = True

        rec_pat = re.compile(r"<REC [^>]+/>")
        while self.running:
            try:
                chunk = self.sock.recv(4096)
                if not chunk:
                    time.sleep(0.01)
                    continue
                self.buffer += chunk.decode("utf-8", errors="ignore")

                for m in rec_pat.finditer(self.buffer):
                    rec_xml = m.group(0)
                    rec = self._parse_rec(rec_xml)
                    if not rec:
                        continue

                    # ¿Estamos en descanso?
                    with self.state["lock"]:
                        in_rest = self.state.get("in_rest", False)
                    if in_rest:
                        # Se descarta el dato, no se escribe
                        continue

                    row = self._build_row(rec)
                    self.csv_writer.writerow(row)
                    self.csv_file.flush()

                # Sanea buffer si crece mucho
                if len(self.buffer) > 20000:
                    self.buffer = self.buffer[-5000:]
            except socket.timeout:
                continue
            except Exception as e:
                print(f"[GP3] Error en loop: {e}")
                time.sleep(0.05)

    def start(self):
        try:
            self.connect()
            self.enable_streams()
            self._open_csv()
        except Exception as e:
            print(f"[GP3] No se iniciará captura de gaze: {e}")
            self.running = False
            return

        self.running = True
        self.thread = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()
        print("[GP3] Hilo de captura iniciado.")

    def close(self):
        # Detener envío de datos y cerrar limpio
        try:
            if self.sock:
                try:
                    self.send('<SET ID="ENABLE_SEND_DATA" STATE="0" />')
                except Exception:
                    pass
        except Exception:
            pass

        self.running = False
        if self.thread:
            self.thread.join(timeout=0.5)

        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
        if self.csv_file:
            try:
                self.csv_file.flush()
                self.csv_file.close()
            except Exception:
                pass
        print("[GP3] Captura gaze detenida.")

# ============================================================
# MAIN
# ============================================================
def main():
    # Verifica carpetas de audio según cupos
    if QUOTAS.get("PST", 0) > 0 and not os.path.isdir(AUDIO_DIR_PST):
        raise RuntimeError(f"La carpeta PST no existe: {AUDIO_DIR_PST}")
    if QUOTAS.get("PFT", 0) > 0 and not os.path.isdir(AUDIO_DIR_PFT):
        raise RuntimeError(f"La carpeta PFT no existe: {AUDIO_DIR_PFT}")

    print("BASE_DIR:", BASE_DIR)
    print("AUDIO_DIR_PST:", AUDIO_DIR_PST)
    print("AUDIO_DIR_PFT:", AUDIO_DIR_PFT)
    print("GIF_DIR:", GIF_DIR)
    print("GIFs esperados (V):", GIF_V_PATHS)

    # Crear carpeta de sesión: Sesiones/S#
    session_dir, session_name, session_number = get_next_session_dir(SESSIONS_ROOT)
    print(f"Sesión actual: {session_name}  ->  {session_dir}")

    # Ruta del CSV de eventos dentro de la sesión
    csv_path = os.path.join(session_dir, f"{session_name}_registro_sesion.csv")

    print("Abriendo puerto...")
    esp = serial.Serial(PORT, BAUD, timeout=TIMEOUT)

    # Logger CSV en tiempo real (EVENTOS)
    logger = CsvLogger(
        csv_path,
        header=["ts_iso", "block_idx", "block_type", "event", "detail"]
    )
    logger.start()

    # Estado compartido
    stim_set = set(STIM_BLOCKS)
    estado = {
        "quotas_rest": QUOTAS.copy(),
        "minutos_por_bloque": MINUTES_PER_BLOCK,
        "total_bloques": NUM_BLOCKS,
        "stim_set": stim_set,
        "current_block": 0,
        "stim_blocks_left_after_current": len([b for b in STIM_BLOCKS if b > 0]),
        "in_rest": False,     # indica si estamos en descanso
        "lock": threading.Lock(),
        "extra_pft_added": False,  # indica si ya agregamos el PFT extra
    }

    # ============================
    # Cálculo de afinidad de CPU
    # ============================
    total_cores = os.cpu_count() or 1
    print(f"[CPU] Núcleos totales detectados: {total_cores}")

    # 4 núcleos para video
    video_cores = list(range(min(4, total_cores)))
    # 2 núcleos para gaze, a continuación
    start_gaze = len(video_cores)
    end_gaze = min(start_gaze + 2, total_cores)
    gaze_cores = list(range(start_gaze, end_gaze))

    print(f"[CPU] Núcleos asignados a VIDEO: {video_cores}")
    print(f"[CPU] Núcleos asignados a GAZE:  {gaze_cores}")
    print("[CPU] El resto de hilos usan la afinidad por defecto del proceso.")

    # Iniciar hilo lector serial (ACKs + autoreporte "1")
    t_reader = threading.Thread(target=hilo_lector, args=(esp, estado, logger), daemon=True)
    t_reader.start()

    # =========================
    # PREPARACIÓN: sonido + vibración de inicio
    # =========================

    print("Enviando vibración de preparación al micro...")
    try:
        prep_cmd = enviar_estimulo_serial(esp, "K", 2.0)
        logger.log(datetime.now().isoformat(), -1, "prep", "prep_vibration", prep_cmd)
    except Exception as e:
        print(f"[WARN] No se pudo enviar vibración de preparación: {e}")

    print("=== FIN PREPARACIÓN, INICIA CAPTURA ===\n")

    # Inicializar video (si cv2 está disponible y hay cámara)
    vidrec = None    # type: VideoRecorder | None
    if CV2_OK:
        cam_idx = choose_camera_index()
        if cam_idx is not None:
            vidrec = VideoRecorder(cam_idx, session_dir, session_name, fps=30, cpu_cores=video_cores)
            vidrec.start()
        else:
            print("[VIDEO] No se inicializará grabación de video.")
    else:
        print("[VIDEO] OpenCV no disponible; sin video.")

    # Inicializar audio (micrófono / webcam)
    audiorec = None  # type: AudioRecorder | None
    if AUDIO_OK:
        try:
            audiorec = AudioRecorder(session_dir, session_name, samplerate=48000, channels=2)
            print("[AUDIO] Grabación de audio lista (usando dispositivo de entrada por defecto).")
            print("        Para usar el micro de la webcam, configúralo como predeterminado en Windows.")
        except Exception as e:
            print(f"[AUDIO] No se pudo inicializar AudioRecorder: {e}")
            audiorec = None
    else:
        print("[AUDIO] No se grabará audio de la webcam (sounddevice/soundfile no disponibles).")

    # Iniciar GazeRecorder (GP3) con CSV independiente
    gaze_rec = GazeRecorder(session_dir, session_name, estado, cpu_cores=gaze_cores)
    gaze_rec.start()

    print("Conectado.")
    print(f"Bloques totales: {NUM_BLOCKS} | Min/bloque: {MINUTES_PER_BLOCK}")
    print(f"Bloques de estimulación: {[i+1 for i in STIM_BLOCKS]}  (los demás: lectura libre)")
    print(f"Cupos (solo en estimulación): {QUOTAS}")
    print(f"Descanso entre bloques: {REST_BETWEEN_BLOCKS_S} segundos")
    print("Ctrl+C para detener.\n")

    try:
        for idx in range(NUM_BLOCKS):
            # Actualiza bloque actual
            with estado["lock"]:
                estado["current_block"] = idx
                estado["in_rest"] = False

            if idx in stim_set:
                print("\n=== PREPARACIÓN DE LA PRUEBA ===")
                print("Reproduciendo sonido de inicio...")
                reproducir_sonido_inicio()
                restantes_stim = [b for b in STIM_BLOCKS if b > idx]
                estado['stim_blocks_left_after_current'] = len(restantes_stim)
                terminado = ejecutar_bloque_estimulos(
                    esp, idx, MINUTES_PER_BLOCK, estado, logger,
                    vidrec=vidrec, audiorec=audiorec
                )
                if terminado:
                    # Cupos completos; aún así los siguientes bloques siguen,
                    # pero sin V/K/A/PST/PFT adicionales.
                    pass
            else:
                print("\n=== PREPARACIÓN DE LA PRUEBA ===")
                print("Reproduciendo sonido de inicio...")
                reproducir_sonido_inicio()
                ejecutar_bloque_libre(
                    esp, idx, MINUTES_PER_BLOCK, estado, logger,
                    vidrec=vidrec, audiorec=audiorec
                )

            # DESCANSO entre bloques
            if idx < NUM_BLOCKS - 1 and REST_BETWEEN_BLOCKS_S > 0:
                with estado["lock"]:
                    estado["in_rest"] = True
                print(f"=== DESCANSO de {REST_BETWEEN_BLOCKS_S} s antes del bloque {idx+2} ===")
                time.sleep(REST_BETWEEN_BLOCKS_S)
                with estado["lock"]:
                    estado["in_rest"] = False

        # ---- AUDIO FINAL DE SESIÓN (solo al terminar el último bloque) ----
        print("\n=== FIN DE TODOS LOS BLOQUES: REPRODUCIENDO AUDIO FINAL DE SESIÓN ===")
        reproducir_sonido_fin_sesion()
        logger.log(datetime.now().isoformat(), -1, "end_session", "play_final_sound", "fin_sesion")

        # Fin de sesión: verificar cupos
        faltantes = {k: v for k, v in estado['quotas_rest'].items() if v > 0}
        if faltantes:
            print("AVISO: No se alcanzaron todos los cupos en los bloques de estimulación.")
            print(f"Faltó disparar: {faltantes}")
            print("Sugerencias: aumenta minutos por bloque, reduce INTERVALO_MAX o añade otro bloque de estimulación.")
        else:
            print("Cupos cumplidos correctamente en los bloques de estimulación.")

    except KeyboardInterrupt:
        print("\nInterrumpido por el usuario.")
    finally:
        print("Cerrando recursos...")
        # cierra serial
        try:
            esp.close()
        except Exception:
            pass
        # cierra audio de reproducción (pygame)
        try:
            if PYGAME_OK and pygame.get_init():
                pygame.mixer.music.stop()
                pygame.quit()
        except Exception:
            pass
        # cierra logger eventos
        try:
            logger.close()
        except Exception:
            pass
        # cierra video
        try:
            if vidrec is not None:
                vidrec.close()
        except Exception:
            pass
        # cierra audio grabación
        try:
            if audiorec is not None:
                audiorec.close()
        except Exception:
            pass
        # cierra gaze
        try:
            if gaze_rec is not None:
                gaze_rec.close()
        except Exception:
            pass
        print("Listo.")

if __name__ == "__main__":
    main()
