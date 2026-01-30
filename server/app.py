#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Flask server para ADL (Asistente de Lectura)
Gestiona la ejecución de experimentos via lector.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import json
import os
import sys
import threading
from datetime import datetime
from pathlib import Path

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False
    print("⚠️  psutil no instalado. Funcionalidad de monitoreo limitada.")

app = Flask(__name__)
CORS(app)

# ============================================================
# CONFIGURACIÓN
# ============================================================

# Directorio del servidor
SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
# Directorio raíz del proyecto
PROJECT_ROOT = os.path.dirname(SERVER_DIR)
# Ruta al script lector.py
LECTOR_SCRIPT = os.path.join(PROJECT_ROOT, "src", "scripts", "scripts", "lector.py")
# Directorio de sesiones (donde se guardan resultados)
SESSIONS_DIR = os.path.join(PROJECT_ROOT, "src", "scripts", "scripts", "Sesiones")

# Estado global de experimentos
experiment_state = {
    "running": False,
    "process": None,
    "process_id": None,
    "session_dir": None,
    "start_time": None,
    "config": {}
}

# ============================================================
# MODELOS / CONFIGURACIÓN POR DEFECTO
# ============================================================

DEFAULT_EXPERIMENT_CONFIG = {
    "num_blocks": 5,
    "minutes_per_block": 5.22,
    "rest_between_blocks_s": 60,
    "stim_blocks": [0, 2, 4],  # índices con estimulación
    "quotas": {
        "V": 2,     # visual
        "K": 2,     # kinestésico
        "A": 2,     # auditivo
        "PST": 3,   # pregunta sobre la tarea
        "PFT": 6    # pregunta fuera de la tarea
    },
    "intervalo_min": 45,
    "intervalo_max": 60,
    "duracion_min": 1,
    "duracion_max": 3,
    "port": "COM9",
    "baud": 115200,
    "gp3_host": "127.0.0.1",
    "gp3_port": 4242
}

# ============================================================
# RUTAS API
# ============================================================

@app.route("/api/experiment/config", methods=["GET"])
def get_experiment_config():
    """Obtiene la configuración actual del experimento"""
    return jsonify({
        "status": "success",
        "config": experiment_state["config"] or DEFAULT_EXPERIMENT_CONFIG,
        "default_config": DEFAULT_EXPERIMENT_CONFIG
    })

@app.route("/api/experiment/config", methods=["POST"])
def set_experiment_config():
    """Establece la configuración del experimento"""
    data = request.get_json()
    
    if not data:
        return jsonify({
            "status": "error",
            "message": "No configuration provided"
        }), 400
    
    # Merge con valores por defecto
    config = {**DEFAULT_EXPERIMENT_CONFIG, **data}
    experiment_state["config"] = config
    
    return jsonify({
        "status": "success",
        "message": "Configuration updated",
        "config": config
    })

@app.route("/api/experiment/start", methods=["POST"])
def start_experiment():
    """Inicia un nuevo experimento ejecutando lector.py"""
    
    if experiment_state["running"]:
        return jsonify({
            "status": "error",
            "message": "Experiment already running"
        }), 409
    
    data = request.get_json() or {}
    
    # Usar configuración enviada o la del estado
    config = {**DEFAULT_EXPERIMENT_CONFIG, **data}
    experiment_state["config"] = config
    
    # Verificar que lector.py existe
    if not os.path.isfile(LECTOR_SCRIPT):
        return jsonify({
            "status": "error",
            "message": f"lector.py not found at {LECTOR_SCRIPT}"
        }), 500
    
    try:
        # Crear variables de entorno con la configuración
        env = os.environ.copy()
        env["GP3_HOST"] = str(config.get("gp3_host", "127.0.0.1"))
        env["GP3_PORT"] = str(config.get("gp3_port", 4242))
        env["COM_PORT"] = str(config.get("port", "COM9"))
        env["BAUD_RATE"] = str(config.get("baud", 115200))
        env["NUM_BLOCKS"] = str(config.get("num_blocks", 5))
        env["MINUTES_PER_BLOCK"] = str(config.get("minutes_per_block", 5.22))
        env["STIM_BLOCKS"] = json.dumps(config.get("stim_blocks", [0, 2, 4]))
        env["QUOTAS"] = json.dumps(config.get("quotas", {}))
        
        # Lanzar lector.py en un proceso separado
        process = subprocess.Popen(
            [sys.executable, LECTOR_SCRIPT],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        
        experiment_state["running"] = True
        experiment_state["process"] = process
        experiment_state["start_time"] = datetime.now().isoformat()
        
        # Thread para monitorear el proceso
        threading.Thread(
            target=_monitor_experiment_process,
            args=(process,),
            daemon=True
        ).start()
        
        return jsonify({
            "status": "success",
            "message": "Experiment started",
            "pid": process.pid,
            "config": config
        })
    
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Failed to start experiment: {str(e)}"
        }), 500

@app.route("/api/experiment/stop", methods=["POST"])
def stop_experiment():
    """Detiene el experimento actual"""
    
    if not experiment_state["running"] or not experiment_state["process"]:
        return jsonify({
            "status": "error",
            "message": "No experiment running"
        }), 400
    
    try:
        process = experiment_state["process"]
        
        # Intentar terminar gracefully
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            # Si no termina, forzar
            process.kill()
        
        experiment_state["running"] = False
        experiment_state["process"] = None
        
        return jsonify({
            "status": "success",
            "message": "Experiment stopped"
        })
    
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Failed to stop experiment: {str(e)}"
        }), 500

@app.route("/api/experiment/status", methods=["GET"])
def get_experiment_status():
    """Obtiene el estado del experimento actual"""
    
    status_data = {
        "running": experiment_state["running"],
        "config": experiment_state["config"] or DEFAULT_EXPERIMENT_CONFIG
    }
    
    if experiment_state["process"]:
        status_data["pid"] = experiment_state["process"].pid
        status_data["start_time"] = experiment_state.get("start_time")
    
    return jsonify({
        "status": "success",
        "data": status_data
    })

@app.route("/api/experiment/sessions", methods=["GET"])
def get_sessions():
    """Lista todas las sesiones de experimentos guardadas"""
    
    sessions = []
    if os.path.isdir(SESSIONS_DIR):
        for session_name in sorted(os.listdir(SESSIONS_DIR)):
            session_path = os.path.join(SESSIONS_DIR, session_name)
            if os.path.isdir(session_path):
                # Buscar archivos CSV
                csv_files = [f for f in os.listdir(session_path) if f.endswith(".csv")]
                sessions.append({
                    "name": session_name,
                    "path": session_path,
                    "files": csv_files,
                    "created": datetime.fromtimestamp(
                        os.path.getctime(session_path)
                    ).isoformat()
                })
    
    return jsonify({
        "status": "success",
        "sessions": sessions
    })

@app.route("/api/experiment/session/<session_name>/data", methods=["GET"])
def get_session_data(session_name):
    """Obtiene los datos de una sesión específica"""
    
    session_path = os.path.join(SESSIONS_DIR, session_name)
    
    if not os.path.isdir(session_path):
        return jsonify({
            "status": "error",
            "message": f"Session {session_name} not found"
        }), 404
    
    data = {
        "session_name": session_name,
        "files": {},
        "path": session_path
    }
    
    # Leer archivos CSV
    for filename in os.listdir(session_path):
        if filename.endswith(".csv"):
            filepath = os.path.join(session_path, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    data["files"][filename] = {
                        "rows": len(lines) - 1,  # excepto header
                        "path": filepath
                    }
            except Exception as e:
                print(f"Error reading {filename}: {e}")
    
    return jsonify({
        "status": "success",
        "data": data
    })

@app.route("/api/health", methods=["GET"])
def health():
    """Health check del servidor Flask"""
    return jsonify({
        "status": "ok",
        "service": "ADL Flask Server",
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "lector_script_exists": os.path.isfile(LECTOR_SCRIPT)
    })

# ============================================================
# NUEVAS RUTAS PARA INTEGRACIÓN CON BD (v2)
# ============================================================

@app.route("/api/v2/experiment/start", methods=["POST"])
def start_experiment_v2():
    """
    Inicia un experimento recibiendo la configuración desde la BD.
    Espera:
    {
        "experiment_id": 123,
        "session_id": "S1",
        "num_blocks": 5,
        "minutes_per_block": 5.22,
        "quotas": {"V": 2, "K": 2, "A": 2, "PST": 3, "PFT": 6},
        "stim_blocks": [0, 2, 4]
    }
    """
    if experiment_state["running"]:
        return jsonify({
            "status": "error",
            "message": "Un experimento ya está en ejecución"
        }), 409

    data = request.get_json() or {}
    
    # Parámetros necesarios
    experiment_id = data.get("experiment_id")
    session_id = data.get("session_id")
    num_blocks = data.get("num_blocks", 5)
    minutes_per_block = data.get("minutes_per_block", 5.22)
    quotas = data.get("quotas", {"V": 2, "K": 2, "A": 2, "PST": 3, "PFT": 6})
    stim_blocks = data.get("stim_blocks", [0, 2, 4])

    if not experiment_id or not session_id:
        return jsonify({
            "status": "error",
            "message": "experiment_id y session_id son requeridos"
        }), 400

    if not os.path.isfile(LECTOR_SCRIPT):
        return jsonify({
            "status": "error",
            "message": f"lector.py no encontrado en {LECTOR_SCRIPT}"
        }), 500

    try:
        # Crear variables de entorno con los parámetros
        env = os.environ.copy()
        env["LECTOR_SESSION_ID"] = str(session_id)
        env["LECTOR_NUM_BLOCKS"] = str(num_blocks)
        env["LECTOR_MINUTES_PER_BLOCK"] = str(minutes_per_block)
        
        # Convertir quotas a formato "V:2,K:2,A:2,PST:3,PFT:6"
        quotas_str = ",".join([f"{k}:{v}" for k, v in quotas.items()])
        env["LECTOR_QUOTAS"] = quotas_str
        
        # Convertir stim_blocks a formato "0,2,4"
        stim_blocks_str = ",".join([str(b) for b in stim_blocks])
        env["LECTOR_STIM_BLOCKS"] = stim_blocks_str

        print(f"[FLASK] Iniciando experimento {experiment_id} (sesión: {session_id})")
        print(f"[FLASK] Parámetros:")
        print(f"  - NUM_BLOCKS: {num_blocks}")
        print(f"  - MINUTES_PER_BLOCK: {minutes_per_block}")
        print(f"  - QUOTAS: {quotas_str}")
        print(f"  - STIM_BLOCKS: {stim_blocks_str}")

        # Lanzar lector.py como proceso independiente
        process = subprocess.Popen(
            [sys.executable, LECTOR_SCRIPT],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        experiment_state["running"] = True
        experiment_state["process"] = process
        experiment_state["process_id"] = process.pid
        experiment_state["start_time"] = datetime.now().isoformat()
        experiment_state["config"] = data

        # Monitoreo en background
        monitor_thread = threading.Thread(
            target=_monitor_experiment_process,
            args=(process,),
            daemon=True
        )
        monitor_thread.start()

        return jsonify({
            "status": "success",
            "message": f"Experimento {experiment_id} iniciado",
            "process_id": process.pid,
            "session_id": session_id
        }), 202

    except Exception as e:
        print(f"[FLASK] Error iniciando experimento: {e}")
        return jsonify({
            "status": "error",
            "message": f"Error al iniciar experimento: {str(e)}"
        }), 500

@app.route("/api/v2/experiment/status", methods=["GET"])
def experiment_status_v2():
    """Obtiene el estado del experimento en ejecución"""
    return jsonify({
        "status": "success",
        "running": experiment_state["running"],
        "process_id": experiment_state["process_id"],
        "start_time": experiment_state["start_time"],
        "current_block": experiment_state["config"].get("current_block", -1)
    })

@app.route("/api/v2/experiment/stop", methods=["POST"])
def stop_experiment_v2():
    """Detiene el experimento en ejecución"""
    if not experiment_state["running"] or not experiment_state["process"]:
        return jsonify({
            "status": "error",
            "message": "No hay experimento en ejecución"
        }), 400

    try:
        process = experiment_state["process"]
        process.terminate()
        process.wait(timeout=5)
        
        experiment_state["running"] = False
        experiment_state["process"] = None

        return jsonify({
            "status": "success",
            "message": "Experimento detenido"
        })
    except Exception as e:
        # Forzar kill si es necesario
        try:
            process.kill()
        except:
            pass
        experiment_state["running"] = False
        experiment_state["process"] = None

        return jsonify({
            "status": "success",
            "message": f"Experimento forzadamente terminado"
        })


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def _monitor_experiment_process(process):
    """Monitorea un proceso de experimento en ejecución"""
    try:
        stdout, stderr = process.communicate()
        if stdout:
            print("[EXPERIMENT OUTPUT]", stdout)
        if stderr:
            print("[EXPERIMENT ERROR]", stderr)
    except Exception as e:
        print(f"Error monitoring experiment: {e}")
    finally:
        experiment_state["running"] = False
        experiment_state["process"] = None

# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":
    print("=" * 60)
    print("ADL Flask Server")
    print("=" * 60)
    print(f"Server directory: {SERVER_DIR}")
    print(f"Project root: {PROJECT_ROOT}")
    print(f"Lector script: {LECTOR_SCRIPT}")
    print(f"Sessions directory: {SESSIONS_DIR}")
    print(f"Lector script exists: {os.path.isfile(LECTOR_SCRIPT)}")
    print("=" * 60)
    
    # Crear directorio de sesiones si no existe
    os.makedirs(SESSIONS_DIR, exist_ok=True)
    
    # Iniciar servidor en puerto 5000
    app.run(host="127.0.0.1", port=5000, debug=False)
