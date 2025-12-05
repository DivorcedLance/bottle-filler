# Documentación del Firmware: Control de Planta Embotelladora

## 1. Descripción General
Este código controla una planta automatizada de llenado de botellas simulada en Proteus. El sistema opera como una **Máquina de Estados Finitos (FSM)** no bloqueante, permitiendo el control simultáneo de actuadores (cinta, bomba), lectura de sensores (ultrasonido, infrarrojo, flujo) y comunicación Serial bidireccional.

## 2. Arquitectura del Sistema

### Hardware Mapeado
* **Sensores:**
    * `PIN_SENSOR_FLUJO (2)`: Interrupción para contar pulsos de líquido (Caudalímetro).
    * `PIN_SENSOR_BOTELLA (7)`: Infrarrojo para detectar posición de llenado.
    * `PIN_TRIG/ECHO (9,10)`: Ultrasonido para medir nivel del tanque principal.
    * `PIN_EMERGENCIA (8)`: Botón físico de parada (Pull-up).
* **Actuadores:**
    * `Cinta Transportadora`: Controlada por Puente H (L298).
    * `Bomba de Agua`: Controlada por Puente H.
    * `Indicadores`: LEDs Verde (Operativo) y Rojo (Error/Parada).

### Lógica de Control (Máquina de Estados)
El sistema utiliza la variable `estadoActual` para determinar el comportamiento en el `loop()` principal. Los estados principales son:

1.  **BUSCANDO_BOTELLA**: Activa la cinta hasta que el sensor IR detecta un objeto.
2.  **BOTELLA_DETECTADA**: Frena la cinta y estabiliza el sistema.
3.  **LLENANDO**: Activa la bomba y cuenta pulsos mediante interrupciones (`ISR`) hasta llegar a la `cantidadMeta`.
4.  **BOTELLA_LLENA**: Espera breve para evitar derrames.
5.  **TRANSPORTANDO**: Reactiva la cinta hasta que la botella abandona el sensor.
6.  **PAUSA_REMOTA / EMERGENCIA_STOP**: Estados de seguridad donde todo se detiene.

## 3. Características Clave

### A. Ejecución Autónoma
El sistema arranca (`setup`) evaluando sensores inmediatamente. Si detecta una botella al encender, pasa directo a llenado; si no, inicia la cinta. No requiere conexión a PC para operar.

### B. Sistema de "Resume" (Memoria)
Al recibir un comando de `STOP`, el sistema guarda el estado actual en `estadoAnterior`. Al recibir `RESUME`, el sistema:
* Restaura el estado exacto.
* Si estaba llenando, **no reinicia el contador de líquido**, continuando desde donde se quedó (ej. si paró en 15/20, reanuda para llenar los 5 restantes).

### C. Comunicación Serial (JSON)
El Arduino envía reportes de estado en formato JSON cada vez que ocurre un evento o periódicamente (Heartbeat de 1s).
* **Formato de Salida:**
    ```json
    {
      "ESTADO": "LLENANDO",
      "PULSOS": 12,
      "META": 20,
      "TANQUE": 85,
      "S_BOTELLA": 1,
      "S_EMERG": 1
    }
    ```
* **Entrada de Comandos:** Escucha comandos como `CMD:START`, `CMD:STOP`, `CMD:RESUME`, `CMD:SET_META:50`.

### D. Interrupciones y Conteo
Se utiliza una interrupción (`attachInterrupt`) para el sensor de flujo. Para evitar lecturas fantasma (inercia del agua), se utiliza una bandera `permitirConteo` que solo habilita la suma de pulsos cuando la bomba está lógicamente encendida.