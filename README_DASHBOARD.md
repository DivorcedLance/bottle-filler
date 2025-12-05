# Dashboard IoT - Planta Embotelladora

Sistema de control y monitoreo en tiempo real para una planta embotelladora con Arduino, desarrollado con Next.js 15, TypeScript, Tailwind CSS y Zustand.

## 🚀 Características

- **Dashboard en Tiempo Real**: Actualización automática cada 1 segundo
- **Gestión de Estado**: Usando Zustand para estado persistente en memoria
- **API REST**: Endpoints para recibir datos del Arduino y enviar comandos
- **Diseño Dark Mode**: Interfaz moderna y responsiva con Tailwind CSS
- **TypeScript**: Código completamente tipado para mayor seguridad

## 📁 Estructura del Proyecto

```
src/
├── app/
│   ├── api/
│   │   ├── update/route.ts      # Recibe datos del Arduino
│   │   ├── status/route.ts      # Devuelve estado al Frontend
│   │   └── commands/route.ts    # Gestiona comandos START/STOP/RESUME/RESET
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                 # Dashboard principal
└── lib/
    └── store.ts                 # Store Zustand (servidor y cliente)
```

## 🔧 API Endpoints

### POST `/api/update`
Recibe el estado desde el Arduino/Python:
```json
{
  "ESTADO": "LLENANDO",
  "PULSOS": 150,
  "META": 200,
  "TANQUE": 85,
  "S_BOTELLA": 1,
  "S_EMERG": 0
}
```

### GET `/api/status`
Devuelve el estado actual al Frontend:
```json
{
  "success": true,
  "data": {
    "ESTADO": "LLENANDO",
    "PULSOS": 150,
    "META": 200,
    "TANQUE": 85,
    "S_BOTELLA": 1,
    "S_EMERG": 0
  },
  "lastUpdate": "2025-12-05T12:34:56.789Z"
}
```

### POST `/api/commands`
Envía comandos desde el Frontend:
```json
{
  "command": "START"  // Opciones: START, STOP, RESUME, RESET
}
```

### GET `/api/commands`
Usado por Python para obtener el siguiente comando pendiente. El comando se elimina automáticamente después de ser leído:
```json
{
  "success": true,
  "command": "START"  // o null si no hay comandos
}
```

## 🛠️ Instalación y Desarrollo

```bash
# Instalar dependencias
npm install

# Modo desarrollo
npm run dev

# Build para producción
npm run build

# Iniciar en producción
npm start
```

## 🌐 Despliegue en Vercel

1. Push del código a GitHub
2. Importar proyecto en Vercel
3. Configurar variables de entorno (si es necesario)
4. Deploy automático

## 📊 Componentes del Dashboard

- **Status Card**: Muestra el estado actual con colores dinámicos
- **Progress Bar**: Visualiza pulsos vs meta de llenado
- **Metric Cards**: Pulsos, Meta y Nivel del Tanque
- **Sensor Indicators**: Estado de sensores de botella y emergencia
- **Control Panel**: Botones para START, STOP, RESUME y RESET

## 🔄 Integración con Arduino/Python

El script de Python debe:

1. **Enviar datos cada segundo a `/api/update`**:
```python
import requests
import json

data = {
    "ESTADO": "LLENANDO",
    "PULSOS": 150,
    "META": 200,
    "TANQUE": 85,
    "S_BOTELLA": 1,
    "S_EMERG": 0
}

response = requests.post('https://tu-app.vercel.app/api/update', json=data)
```

2. **Consultar comandos en `/api/commands`**:
```python
response = requests.get('https://tu-app.vercel.app/api/commands')
result = response.json()

if result['command']:
    # Enviar comando al Arduino
    send_to_arduino(result['command'])
```

## 🎨 Personalización

### Colores del Estado
Modifica la función `getStatusColor` en `page.tsx`:
- Verde: LLENANDO, OPERANDO
- Rojo: ERROR, EMERGENCIA
- Amarillo: ESPERA, PAUSADO
- Azul: Otros estados

### Intervalo de Actualización
Cambia `refreshInterval` en el hook `useMachineStatus`:
```typescript
refreshInterval: 1000, // milisegundos
```

## 📝 Notas Técnicas

- **Store en Memoria**: Los datos persisten mientras el servidor de Next.js esté activo
- **Singleton Pattern**: Un único store compartido para todas las peticiones
- **SWR**: Maneja caché, revalidación y polling automático
- **Zustand**: Store minimalista y eficiente

## 🔐 Seguridad

Para producción, considera:
- Validación de origen de peticiones
- Rate limiting
- Autenticación con tokens
- HTTPS obligatorio

## 📄 Licencia

Proyecto educativo para control de planta embotelladora.
