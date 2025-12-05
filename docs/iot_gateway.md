# Documentación del Gateway IoT (Python Adapter)

## 1. Objetivo
El script `api_adapter.py` actúa como un puente (Gateway) entre el hardware físico/simulado (comunicación Serial UART) y la nube (API REST en Vercel). Su función es permitir el monitoreo y control remoto en tiempo real.

## 2. Estructura de Procesos (Multithreading)
Dado que la comunicación Serial y las peticiones HTTP son bloqueantes (pueden congelar el programa), el script utiliza **3 hilos de ejecución paralelos**:

### Hilo 1: Escucha Serial (`escuchar_arduino`)
* **Función:** Monitorea constantemente el puerto COM configurado.
* **Lógica:**
    * Lee byte a byte hasta encontrar un salto de línea `\n`.
    * Valida si la cadena es un JSON válido.
    * Actualiza una variable global en memoria (`ultimo_estado_json`) con los datos más frescos de la máquina.

### Hilo 2: Sincronización Nube (`hilo_nube`)
* **Frecuencia:** Ciclo cada 2 segundos.
* **Acción A (Subida - POST):**
    * Toma el último JSON recibido del Arduino.
    * Lo envía al endpoint `/api/update` del backend.
* **Acción B (Bajada - GET):**
    * Consulta al endpoint `/api/commands`.
    * Si el backend responde con un comando (ej. `{"command": "CMD:STOP"}`), el script lo inyecta inmediatamente al puerto Serial hacia el Arduino.

### Hilo Principal: Interfaz Local (`Main`)
* Mantiene la conexión Serial abierta.
* Permite al operador escribir comandos manualmente en la consola (ej. `START`, `TEST BOMBA`) que tienen prioridad sobre los comandos de la nube.

## 3. Flujo de Datos

1.  **Arduino** → Serial → **Python** → `requests.post()` → **Vercel DB** (Visualización en Web).
2.  **Usuario Web** (Click en Botón) → **Vercel DB** (Cola de comandos) → `requests.get()` → **Python** → Serial → **Arduino**.

## 4. Manejo de Errores
* **Reconexión:** El script maneja excepciones de desconexión Serial o falta de internet sin cerrarse, intentando continuar el ciclo.
* **Timeouts:** Las peticiones HTTP tienen un límite de espera corto para no retrasar la detección de sensores críticos.