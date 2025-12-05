// --- PINOUT DEL SISTEMA ---
const int PIN_SENSOR_FLUJO = 2;   
const int PIN_CINTA_IN2 = 4;
const int PIN_CINTA_IN1 = 5;
const int PIN_CINTA_ENA = 6;
const int PIN_SENSOR_BOTELLA = 7; 
const int PIN_EMERGENCIA = 8;
const int PIN_TRIG = 9;
const int PIN_ECHO = 10;
const int PIN_BOMBA_ENB = 11;
const int PIN_BOMBA_IN3 = 12;
const int PIN_BOMBA_IN4 = 13;
const int PIN_LED_VERDE = A1;
const int PIN_LED_ROJO = A2;

// --- VARIABLES DE ESTADO ---
volatile int pulsosFlujo = 0;
volatile bool flagNuevoPulso = false;
volatile bool permitirConteo = false;

long distanciaTanque = 0;

// [CAMBIO CLAVE 1] El sistema nace ACTIVO. No espera a Python.
bool sistemaActivo = true; 
String estadoActual = "INICIANDO"; 
String estadoAnterior = ""; // Para la lógica de RESUME
String comandoInput = "";

int cantidadMeta = 20; 

void setup() {
  Serial.begin(9600); // Iniciamos comunicación, pero no bloqueamos esperando conexión
  
  pinMode(PIN_CINTA_ENA, OUTPUT); pinMode(PIN_CINTA_IN1, OUTPUT); pinMode(PIN_CINTA_IN2, OUTPUT);
  pinMode(PIN_BOMBA_ENB, OUTPUT); pinMode(PIN_BOMBA_IN3, OUTPUT); pinMode(PIN_BOMBA_IN4, OUTPUT);
  pinMode(PIN_TRIG, OUTPUT); pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_SENSOR_BOTELLA, INPUT);
  pinMode(PIN_EMERGENCIA, INPUT_PULLUP);
  pinMode(PIN_LED_VERDE, OUTPUT); pinMode(PIN_LED_ROJO, OUTPUT);
  pinMode(PIN_SENSOR_FLUJO, INPUT_PULLUP);
  
  attachInterrupt(digitalPinToInterrupt(PIN_SENSOR_FLUJO), isrContarPulso, RISING);

  // Prendemos LEDs para indicar arranque
  digitalWrite(PIN_LED_VERDE, HIGH); digitalWrite(PIN_LED_ROJO, LOW);
  
  // [CAMBIO CLAVE 2] Lógica de arranque inmediato
  // Verificamos si ya hay una botella puesta al encender
  if (digitalRead(PIN_SENSOR_BOTELLA) == HIGH) {
      estadoActual = "BOTELLA_DETECTADA";
      pararCinta();
      digitalWrite(PIN_LED_VERDE, LOW); digitalWrite(PIN_LED_ROJO, HIGH);
  } else {
      estadoActual = "BUSCANDO_BOTELLA";
      digitalWrite(PIN_LED_VERDE, HIGH); digitalWrite(PIN_LED_ROJO, LOW);
      moverCinta(); // ¡Arranca la cinta de una vez!
  }
  
  reportarEstado(); 
}

void loop() {
  // 1. Siempre escuchamos (Serial y Botón) sin bloquear
  verificarEntradas();

  // 2. Si nos han pausado (STOP) o hay emergencia, no hacemos nada más
  if (!sistemaActivo || estadoActual == "EMERGENCIA_STOP" || estadoActual == "PAUSA_REMOTA") {
      return;
  }

  // --- MÁQUINA DE ESTADOS AUTOMÁTICA ---
  
  // CASO A: Estamos buscando botella (Cinta moviéndose)
  if (estadoActual == "BUSCANDO_BOTELLA") {
      // Nos aseguramos que la cinta se mueva (por si venimos de un Resume)
      moverCinta(); 
      digitalWrite(PIN_LED_VERDE, HIGH); digitalWrite(PIN_LED_ROJO, LOW);
      
      if (digitalRead(PIN_SENSOR_BOTELLA) == HIGH) {
          // ¡Botella encontrada!
          pararCinta();
          digitalWrite(PIN_LED_VERDE, LOW); digitalWrite(PIN_LED_ROJO, HIGH);
          
          estadoActual = "BOTELLA_DETECTADA";
          reportarEstado();
          delay(1000); // Tiempo para estabilizar botella
          
          // Preparamos llenado
          pulsosFlujo = 0; 
          estadoActual = "LLENANDO"; 
      }
  }
  
  // CASO B: Llenado
  else if (estadoActual == "LLENANDO") {
      llenarBotella(); 
      
      // Si salimos de la función y seguimos activos, es que terminó bien
      if (sistemaActivo) {
          estadoActual = "BOTELLA_LLENA";
          reportarEstado();
          delay(500);
          estadoActual = "TRANSPORTANDO";
      }
  }

  // CASO C: Sacar la botella
  else if (estadoActual == "TRANSPORTANDO") {
      reportarEstado();
      digitalWrite(PIN_LED_VERDE, HIGH); digitalWrite(PIN_LED_ROJO, LOW);
      moverCinta();

      // Esperamos a que la botella se vaya
      while(digitalRead(PIN_SENSOR_BOTELLA) == HIGH) {
         verificarEntradas(); 
         if(!sistemaActivo) return; // Si pausan, salimos inmediatamente
         delay(50);
      }
      
      // Ya se fue, volvemos a buscar
      estadoActual = "BUSCANDO_BOTELLA";
      reportarEstado();
  }

  // --- REPORTE PERIÓDICO (HEARTBEAT) ---
  // Esto manda datos a Python aunque Python no haya preguntado nada
  static unsigned long lastMedicion = 0;
  if (millis() - lastMedicion > 1000) {
    medirNivelTanque();
    // Reportamos si estamos esperando o pausados, para mantener el dashboard vivo
    if(estadoActual == "BUSCANDO_BOTELLA" || estadoActual == "PAUSA_REMOTA" || estadoActual == "EMERGENCIA_STOP") {
        reportarEstado(); 
    }
    lastMedicion = millis();
  }
}

// --- GESTIÓN DE ENTRADAS ---
void verificarEntradas() {
    escucharSerial(); 
    
    // Botón Físico de Emergencia
    if (digitalRead(PIN_EMERGENCIA) == LOW) {
        if (estadoActual != "EMERGENCIA_STOP") {
            estadoAnterior = estadoActual; 
            detenerTodo();
            estadoActual = "EMERGENCIA_STOP";
            sistemaActivo = false;
            digitalWrite(PIN_LED_ROJO, HIGH);
            reportarEstado();
            while(digitalRead(PIN_EMERGENCIA) == LOW); // Anti-rebote
        }
    }
}

void escucharSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n') {
      procesarComando(comandoInput);
      comandoInput = "";
    } else {
      comandoInput += c;
    }
  }
}

void procesarComando(String cmd) {
  cmd.trim(); 
  
  // --- STOP ---
  if (cmd == "CMD:STOP") { 
      if (sistemaActivo) {
          estadoAnterior = estadoActual; // Guardamos dónde estábamos
      }
      sistemaActivo = false; 
      detenerTodo(); 
      permitirConteo = false;
      estadoActual = "PAUSA_REMOTA";
      reportarEstado();
  }
  
  // --- START (Reinicio total) ---
  else if (cmd == "CMD:START") { 
      sistemaActivo = true; 
      pulsosFlujo = 0; 
      // Lógica inteligente: Si ya hay botella, no arranques la cinta a lo loco
      if (digitalRead(PIN_SENSOR_BOTELLA) == HIGH) {
          estadoActual = "BOTELLA_DETECTADA"; // Irá a llenar en el siguiente loop
      } else {
          estadoActual = "BUSCANDO_BOTELLA"; 
          moverCinta();
      }
      reportarEstado();
  }

  // --- RESUME (Continuar donde estaba) ---
  else if (cmd == "CMD:RESUME") {
      if (!sistemaActivo) { 
          sistemaActivo = true;
          estadoActual = estadoAnterior; 
          reportarEstado();
          
          if (estadoActual == "LLENANDO") {
              permitirConteo = true; // Bomba arranca sola en el loop
          } 
          else if (estadoActual == "BUSCANDO_BOTELLA" || estadoActual == "TRANSPORTANDO") {
              moverCinta();
          }
      }
  }
  
  // --- TESTS (Solo funcionan si la máquina no está trabajando) ---
  // He añadido protección para que no interrumpan el llenado automático
  else if (cmd == "CMD:TEST_BOMBA") {
      if (estadoActual != "LLENANDO") { 
          String prev = estadoActual;
          estadoActual = "TEST_BOMBA"; reportarEstado();
          pararCinta();
          digitalWrite(PIN_BOMBA_IN3, HIGH); digitalWrite(PIN_BOMBA_IN4, LOW); analogWrite(PIN_BOMBA_ENB, 200);
          delay(1500);
          digitalWrite(PIN_BOMBA_IN3, LOW); digitalWrite(PIN_BOMBA_IN4, LOW); analogWrite(PIN_BOMBA_ENB, 0);
          estadoActual = prev;
          if(estadoActual == "BUSCANDO_BOTELLA") moverCinta();
          reportarEstado();
      }
  }
  else if (cmd == "CMD:TEST_CINTA") {
      if (estadoActual != "LLENANDO") {
          String prev = estadoActual;
          estadoActual = "TEST_CINTA"; reportarEstado();
          moverCinta();
          delay(1500);
          pararCinta();
          estadoActual = prev;
          if(estadoActual == "BUSCANDO_BOTELLA") moverCinta();
          reportarEstado();
      }
  }
  else if (cmd.startsWith("CMD:SET_META:")) {
      String valorStr = cmd.substring(13);
      int nuevoValor = valorStr.toInt();
      if (nuevoValor > 0) cantidadMeta = nuevoValor;
  }
}

// --- FUNCIÓN DE REPORTE COMPLETO ---
void reportarEstado() {
  // Enviamos JSON aunque nadie escuche. Serial es asíncrono.
  Serial.print("{");
  Serial.print("\"ESTADO\":\"" + estadoActual + "\",");
  Serial.print("\"PULSOS\":" + String(pulsosFlujo) + ",");
  Serial.print("\"META\":" + String(cantidadMeta) + ",");
  Serial.print("\"TANQUE\":" + String(distanciaTanque) + ",");
  Serial.print("\"S_BOTELLA\":" + String(digitalRead(PIN_SENSOR_BOTELLA)) + ",");
  Serial.print("\"S_EMERG\":" + String(digitalRead(PIN_EMERGENCIA))); 
  Serial.println("}");
}

// --- LÓGICA DE LLENADO ---
void llenarBotella() {
  permitirConteo = true; 
  reportarEstado();
  
  digitalWrite(PIN_BOMBA_IN3, HIGH); digitalWrite(PIN_BOMBA_IN4, LOW); analogWrite(PIN_BOMBA_ENB, 255);
  
  while (pulsosFlujo < cantidadMeta) { 
    verificarEntradas(); // Permite pausar a mitad de llenado
    
    if (!sistemaActivo) { 
        detenerTodo(); 
        permitirConteo = false; 
        return; 
    }
    
    if (flagNuevoPulso) {
      reportarEstado();
      flagNuevoPulso = false; 
    }
  }
  
  digitalWrite(PIN_BOMBA_IN3, LOW); digitalWrite(PIN_BOMBA_IN4, LOW); analogWrite(PIN_BOMBA_ENB, 0);
  permitirConteo = false; 
}

// Funciones auxiliares
void isrContarPulso() { if (permitirConteo) { pulsosFlujo++; flagNuevoPulso = true; } }
void medirNivelTanque() { digitalWrite(PIN_TRIG, LOW); delayMicroseconds(2); digitalWrite(PIN_TRIG, HIGH); delayMicroseconds(10); digitalWrite(PIN_TRIG, LOW); long dur = pulseIn(PIN_ECHO, HIGH); distanciaTanque = dur * 0.034 / 2; }
void moverCinta() { digitalWrite(PIN_CINTA_IN1, HIGH); digitalWrite(PIN_CINTA_IN2, LOW); analogWrite(PIN_CINTA_ENA, 255); }
void pararCinta() { digitalWrite(PIN_CINTA_IN1, LOW); digitalWrite(PIN_CINTA_IN2, LOW); analogWrite(PIN_CINTA_ENA, 0); }
void detenerTodo() { pararCinta(); digitalWrite(PIN_BOMBA_IN3, LOW); digitalWrite(PIN_BOMBA_IN4, LOW); analogWrite(PIN_BOMBA_ENB, 0); }