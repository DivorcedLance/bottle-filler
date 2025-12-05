import serial
import time
import json
import threading
import requests
from datetime import datetime

# --- CONFIGURACIÓN ---
SERIAL_PORT = 'COM7'       
BAUD_RATE = 9600
# API_URL = "https://prohect.vercel.app/api"
API_URL = "http://localhost:3000/api"

# Variables globales compartidas
ser = None
running = True
ultimo_estado_json = {} # Aquí guardamos lo último que dijo el Arduino

def conectar_arduino():
    global ser
    try:
        ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=0.1)
        print(f"✅ Conectado a Arduino en {SERIAL_PORT}")
        return True
    except Exception as e:
        print(f"❌ Error conectando a Arduino: {e}")
        return False

# --- HILO 1: ESCUCHAR ARDUINO (Igual que antes pero guarda en variable) ---
def escuchar_arduino():
    global ultimo_estado_json
    buffer = ""
    while running:
        if ser and ser.is_open:
            try:
                if ser.in_waiting > 0:
                    char = ser.read().decode('utf-8', errors='ignore')
                    if char == '\n':
                        linea = buffer.strip()
                        if linea.startswith("{") and linea.endswith("}"):
                            try:
                                # Guardamos el JSON en memoria para enviarlo luego
                                ultimo_estado_json = json.loads(linea)
                                # Opcional: Imprimir en consola local para debug
                                print(f"[ARDUINO]: {linea}") 
                            except: pass
                        buffer = ""
                    else:
                        buffer += char
            except: pass
        time.sleep(0.001)

# --- HILO 2: SINCRONIZACIÓN CON VERCEL (NUBE) ---
def hilo_nube():
    while running:
        # 1. ENVIAR DATOS (POST)
        if ultimo_estado_json:
            try:
                # Enviamos el JSON tal cual viene del Arduino al endpoint /update
                requests.post(f"{API_URL}/update", json=ultimo_estado_json, timeout=2)
                # print("☁️ Datos subidos a Vercel") 
            except Exception as e:
                print(f"⚠️ Error subiendo datos: {e}")

        # 2. RECIBIR ÓRDENES (GET)
        try:
            # Consultamos si hay comandos pendientes en la cola
            resp = requests.get(f"{API_URL}/commands", timeout=2)
            if resp.status_code == 200:
                data = resp.json()
                comando_nube = data.get("command") # Esperamos {"command": "CMD:STOP"}
                
                if comando_nube:
                    print(f"📥 COMANDO RECIBIDO DE LA NUBE: {comando_nube}")
                    enviar_comando_arduino(comando_nube)
        except Exception as e:
            print(f"⚠️ Error consultando comandos: {e}")

        # Esperamos 2 segundos para no saturar tu servidor ni el Arduino
        time.sleep(2)

def enviar_comando_arduino(cmd):
    if ser and ser.is_open:
        msg = cmd.strip() + "\n"
        ser.write(msg.encode('utf-8'))

# --- MAIN: CONTROL LOCAL ---
if __name__ == "__main__":
    print("--- GATEWAY IOT INICIADO ---")
    if conectar_arduino():
        # Iniciamos hilos en segundo plano
        t_serial = threading.Thread(target=escuchar_arduino)
        t_serial.daemon = True
        t_serial.start()

        t_nube = threading.Thread(target=hilo_nube)
        t_nube.daemon = True
        t_nube.start()

        print(f"📡 Conectando a backend: {API_URL}")
        print("⌨️  Control Local habilitado (Escribe comandos aquí)...")

        try:
            while True:
                # El input bloquea, por eso usamos hilos para lo demás
                entrada = input() 
                cmd = entrada.strip().upper()
                
                # Mapeo rápido de comandos locales
                msg = ""
                if cmd == "SALIR": break
                elif cmd == "START": msg = "CMD:START"
                elif cmd == "STOP": msg = "CMD:STOP"
                elif cmd == "RESUME": msg = "CMD:RESUME"
                elif "TEST" in cmd: msg = f"CMD:{cmd}" # CMD:TEST_BOMBA
                elif "META" in cmd: msg = f"CMD:SET_META:{cmd.split()[-1]}"
                
                if msg:
                    enviar_comando_arduino(msg)
                    print(f"➡️ Enviado localmente: {msg}")

        except KeyboardInterrupt:
            print("\nApagando...")
        finally:
            running = False
            ser.close()