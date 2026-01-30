import os
from moviepy import VideoFileClip  # IMPORT CORRECTO PARA MOVIEPY 2.x

# Carpeta base donde está este script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Carpeta donde tienes los videos (dentro del proyecto)
VIDEO_DIR = os.path.join(BASE_DIR, "gifs_visuales")


def video_a_gif(video_name, fps=12, resize=1.0):
    """
    Convierte un archivo de video de VIDEO_DIR a GIF en la misma carpeta.

    video_name : nombre del archivo de video (ej. "conejo1.mp4")
    fps        : frames por segundo del gif
    resize     : factor de escala (1.0 = tamaño original)
    """
    ruta_video = os.path.join(VIDEO_DIR, video_name)
    nombre_base, _ = os.path.splitext(video_name)
    ruta_gif = os.path.join(VIDEO_DIR, nombre_base + ".gif")

    if not os.path.isfile(ruta_video):
        print(f"[X] No se encontró el video: {ruta_video}")
        return

    print(f"[>] Convirtiendo {ruta_video} -> {ruta_gif}")
    clip = VideoFileClip(ruta_video)

    # Redimensionar usando la nueva función resized() en MoviePy 2.x
    if resize != 1.0:
        clip = clip.resized(resize)

    clip.write_gif(ruta_gif, fps=fps)
    print(f"[✔] GIF guardado en: {ruta_gif}")


def convertir_todos_los_videos(fps=12, resize=1.0):
    """
    Recorre VIDEO_DIR y convierte todos los videos a GIF.
    """
    if not os.path.isdir(VIDEO_DIR):
        print(f"[X] La carpeta de videos no existe: {VIDEO_DIR}")
        return

    extensiones_video = (".mp4", ".mov", ".avi", ".mkv", ".webm")

    for fname in os.listdir(VIDEO_DIR):
        if fname.lower().endswith(extensiones_video):
            video_a_gif(fname, fps=fps, resize=resize)


if __name__ == "__main__":
    # Convierte todos los videos de gifs_visuales a GIF
    convertir_todos_los_videos(fps=12, resize=0.7)
