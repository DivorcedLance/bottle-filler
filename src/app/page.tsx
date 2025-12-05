'use client';

import { useEffect } from 'react';
import useSWR from 'swr';
import { useClientStore, MachineState } from '@/lib/store';

/**
 * Fetcher para SWR
 */
const fetcher = (url: string) => fetch(url).then((res) => res.json());

/**
 * Hook personalizado para obtener el estado de la máquina
 */
function useMachineStatus() {
  const { data, error, isLoading } = useSWR('/api/status', fetcher, {
    refreshInterval: 1000, // Polling cada 1 segundo
    revalidateOnFocus: false,
    dedupingInterval: 500
  });

  return {
    machineState: data?.data as MachineState | undefined,
    isLoading,
    isError: error,
    lastUpdate: data?.lastUpdate
  };
}

/**
 * Función para enviar comandos
 */
async function sendCommand(command: string) {
  try {
    const response = await fetch('/api/commands', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Error al enviar comando');
    }

    return data;
  } catch (error) {
    console.error('Error al enviar comando:', error);
    throw error;
  }
}

/**
 * Componente: Status Card
 */
function StatusCard({ estado }: { estado: string }) {
  const getStatusColor = (state: string) => {
    const lowerState = state.toLowerCase();
    
    if (lowerState.includes('error') || lowerState.includes('emerg')) {
      return 'bg-red-500';
    }
    if (lowerState.includes('llenando') || lowerState.includes('operando')) {
      return 'bg-green-500';
    }
    if (lowerState.includes('espera') || lowerState.includes('pausado')) {
      return 'bg-yellow-500';
    }
    return 'bg-blue-500';
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-2xl border border-gray-700">
      <h3 className="text-gray-400 text-sm font-medium mb-2">Estado Actual</h3>
      <div className="flex items-center gap-3">
        <div className={`w-4 h-4 rounded-full ${getStatusColor(estado)} animate-pulse`}></div>
        <span className="text-3xl font-bold text-white">{estado}</span>
      </div>
    </div>
  );
}

/**
 * Componente: Progress Bar
 */
function ProgressBar({ pulsos, meta }: { pulsos: number; meta: number }) {
  const percentage = meta > 0 ? Math.min((pulsos / meta) * 100, 100) : 0;

  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-2xl border border-gray-700">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-gray-400 text-sm font-medium">Progreso de Llenado</h3>
        <span className="text-white font-bold">{pulsos} / {meta}</span>
      </div>
      
      <div className="w-full bg-gray-700 rounded-full h-6 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-300 ease-out flex items-center justify-center"
          style={{ width: `${percentage}%` }}
        >
          {percentage > 10 && (
            <span className="text-xs font-bold text-white">{percentage.toFixed(1)}%</span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Componente: Sensor Indicator
 */
function SensorIndicator({ label, active, inverted = false }: { label: string; active: boolean; inverted?: boolean }) {
  // Si es invertido (como el botón de emergencia), verde cuando NO está presionado (1), rojo cuando está presionado (0)
  const isOk = inverted ? active : active;
  const color = isOk ? 'bg-green-500' : (inverted ? 'bg-red-500' : 'bg-gray-600');
  const textColor = isOk ? 'text-green-400' : (inverted ? 'text-red-400' : 'text-gray-500');
  const status = inverted 
    ? (active ? '✓ NORMAL' : '🚨 PRESIONADO') 
    : (active ? 'ACTIVO' : 'INACTIVO');
  
  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow-2xl border border-gray-700">
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm font-medium">{label}</span>
        <div className={`w-6 h-6 rounded-full ${color} ${isOk ? 'animate-pulse' : ''} transition-colors duration-300`}>
        </div>
      </div>
      <div className="mt-2 text-right">
        <span className={`text-xs font-semibold ${textColor}`}>
          {status}
        </span>
      </div>
    </div>
  );
}

/**
 * Componente: Metric Card
 */
function MetricCard({ label, value, unit, icon }: { label: string; value: number; unit: string; icon: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-6 shadow-2xl border border-gray-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium mb-1">{label}</p>
          <p className="text-3xl font-bold text-white">
            {value}
            <span className="text-lg text-gray-400 ml-1">{unit}</span>
          </p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );
}

/**
 * Componente: Simulación Gráfica de la Máquina
 */
function MachineSimulation({ state }: { state: MachineState }) {
  // Determinar posición de la botella según el estado
  const getBottlePosition = () => {
    if (state.ESTADO === 'BUSCANDO_BOTELLA' || state.ESTADO === 'TRANSPORTANDO') {
      return 'left-[200px]'; // Inicio de la cinta
    } else if (state.ESTADO === 'BOTELLA_DETECTADA') {
      return 'left-[400px]'; // Animación moviéndose por la cinta
    } else if (state.ESTADO === 'LLENANDO' || state.ESTADO === 'BOTELLA_LLENA') {
      return 'left-[500px]'; // Posición de llenado (más cerca del final)
    }
    return 'left-[500px]'; // Por defecto
  };

  const bottleInConveyor = state.ESTADO === 'BUSCANDO_BOTELLA' || state.ESTADO === 'TRANSPORTANDO';
  const bottleMoving = state.ESTADO === 'BOTELLA_DETECTADA';
  const bottleFilling = state.ESTADO === 'LLENANDO' || state.ESTADO === 'BOTELLA_LLENA';
  const showBottle = state.S_BOTELLA === 1 || bottleInConveyor;

  return (
    <div className="bg-gray-800 rounded-xl p-8 shadow-2xl border border-gray-700">
      <h2 className="text-2xl font-bold mb-6 text-center">Simulación de la Planta</h2>
      
      <div className="relative h-96 bg-gray-900 rounded-lg overflow-hidden">
        {/* Tanque */}
        <div className="absolute left-8 top-8 w-32 h-48 border-4 border-gray-600 rounded-lg bg-gray-800">
          <div className="absolute bottom-0 w-full bg-blue-400 transition-all duration-500 rounded-b-lg" 
               style={{ height: `${state.TANQUE}%` }}>
          </div>
          <div className="absolute top-2 left-2 text-xs text-gray-400">TANQUE</div>
          <div className="absolute bottom-2 right-2 text-sm font-bold text-white">{state.TANQUE}%</div>
        </div>

        {/* Tubería desde tanque a bomba */}
        <div className={`absolute left-28 top-56 w-1 h-12 ${state.M_BOMBA === 1 ? 'bg-blue-400' : 'bg-gray-600'} transition-colors`}></div>

        {/* Bomba */}
        <div className={`absolute left-20 top-64 w-16 h-16 rounded-full border-4 ${
          state.M_BOMBA === 1 ? 'border-blue-500 bg-blue-500/20' : 'border-gray-600 bg-gray-800'
        } flex items-center justify-center transition-all`}>
          <span className="text-2xl">{state.M_BOMBA === 1 ? '💧' : '⭕'}</span>
          {state.M_BOMBA === 1 && (
            <div className="absolute inset-0 rounded-full border-4 border-blue-400 animate-ping"></div>
          )}
        </div>
        <div className="absolute left-14 top-80 text-xs text-gray-400">BOMBA</div>

        {/* Tubería desde bomba a zona de llenado */}
        <div className={`absolute left-36 top-72 w-48 h-1 ${state.M_BOMBA === 1 && state.S_BOTELLA === 1 ? 'bg-blue-400' : 'bg-gray-600'} transition-colors`}></div>
        
        {/* Pico de llenado */}
        <div className="absolute left-[500px] top-[272px] w-2 h-8 bg-gray-500 rounded-b">
          {state.M_BOMBA === 1 && bottleFilling && (
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-1 h-12 bg-blue-400 animate-pulse"></div>
          )}
        </div>

        {/* Cinta transportadora - Más larga */}
        <div className="absolute left-48 bottom-8 w-[500px] h-5 bg-gray-700 rounded-lg border-2 border-gray-600">
          {/* Animación de movimiento de la cinta */}
          {(state.M_CINTA === 1 || bottleInConveyor) && (
            <>
              {/* Líneas de movimiento */}
              <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
                <div className="absolute top-1/2 transform -translate-y-1/2 w-full h-0.5 bg-gradient-to-r from-transparent via-gray-400 to-transparent animate-[slideConveyor_1s_linear_infinite]"></div>
                <div className="absolute top-1/2 transform -translate-y-1/2 w-full h-0.5 bg-gradient-to-r from-transparent via-gray-400 to-transparent animate-[slideConveyor_1s_linear_infinite] delay-500"></div>
              </div>
              {/* Rodillos animados */}
              <div className="absolute top-1/2 transform -translate-y-1/2 flex gap-8 animate-[slideRollers_1.5s_linear_infinite]">
                {[...Array(20)].map((_, i) => (
                  <div key={i} className="w-1 h-1 bg-yellow-500 rounded-full"></div>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="absolute left-96 bottom-1 text-xs text-gray-400">CINTA TRANSPORTADORA</div>

        {/* Botella - Posición dinámica y tamaño mejorado */}
        {showBottle && (
          <div className={`absolute bottom-[42px] transition-all ${
            bottleMoving ? 'duration-2000' : 'duration-500'
          } ${getBottlePosition()}`}>
            {bottleFilling ? (
              // Botella grande durante llenado
              <div className="relative w-16 h-24">
                {/* Cuerpo de la botella */}
                <div className="absolute bottom-0 w-16 h-20 bg-gradient-to-b from-gray-200/30 to-gray-300/60 border-3 border-gray-400 rounded-b-xl backdrop-blur-sm"></div>
                {/* Cuello */}
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-5 h-6 bg-gradient-to-b from-gray-400/50 to-gray-300/60 border-2 border-gray-400 rounded-t"></div>
                {/* Tapa */}
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-6 h-2 bg-gray-500 rounded-t-sm"></div>
                
                {/* Nivel de líquido con efecto de onda */}
                {state.ESTADO === 'LLENANDO' && (
                  <div 
                    className="absolute bottom-0 w-16 bg-gradient-to-t from-blue-500 to-blue-300 transition-all duration-300 rounded-b-xl overflow-hidden"
                    style={{ height: `${Math.min((state.PULSOS / state.META) * 80, 80)}px` }}
                  >
                    <div className="absolute top-0 w-full h-1 bg-blue-200 animate-pulse"></div>
                  </div>
                )}
                
                {state.ESTADO === 'BOTELLA_LLENA' && (
                  <div className="absolute bottom-0 w-16 h-20 bg-gradient-to-t from-blue-500 to-blue-300 rounded-b-xl">
                    <div className="absolute top-0 w-full h-1 bg-blue-200"></div>
                  </div>
                )}

                {/* Brillo en la botella */}
                <div className="absolute top-6 left-2 w-2 h-8 bg-white/30 rounded-full blur-sm"></div>
              </div>
            ) : (
              // Botella normal en la cinta
              <div className="relative w-10 h-16">
                <div className="absolute bottom-0 w-10 h-14 bg-gradient-to-b from-gray-200/40 to-gray-300/60 border-2 border-gray-400 rounded-b-lg backdrop-blur-sm"></div>
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-3 h-4 bg-gradient-to-b from-gray-400/50 to-gray-300/60 border-2 border-gray-400 rounded-t"></div>
                <div className="absolute top-5 left-1 w-1.5 h-6 bg-white/20 rounded-full blur-sm"></div>
              </div>
            )}
          </div>
        )}

        {/* LEDs indicadores */}
        <div className="absolute right-8 top-8 space-y-4">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${state.L_VERDE === 1 ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-gray-700'} transition-all`}></div>
            <span className="text-xs text-gray-400">LED Verde</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full ${state.L_ROJO === 1 ? 'bg-red-500 shadow-lg shadow-red-500/50' : 'bg-gray-700'} transition-all`}></div>
            <span className="text-xs text-gray-400">LED Rojo</span>
          </div>
        </div>

        {/* Botón de emergencia */}
        <div className="absolute right-8 bottom-8">
          <div className={`w-16 h-16 rounded-full border-4 ${
            state.S_EMERG === 0 ? 'border-red-600 bg-red-600' : 'border-gray-600 bg-gray-800'
          } flex items-center justify-center transition-all`}>
            <span className="text-2xl">{state.S_EMERG === 0 ? '🚨' : '🔴'}</span>
          </div>
          <div className="text-xs text-gray-400 text-center mt-2">EMERGENCIA</div>
        </div>

        {/* Estado actual overlay */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-900/90 px-6 py-3 rounded-lg border border-gray-700">
          <div className="text-center">
            <div className="text-xs text-gray-400">Estado</div>
            <div className="text-lg font-bold text-white">{state.ESTADO}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Componente: Control Button
 */
function ControlButton({ 
  command, 
  label, 
  icon, 
  variant = 'primary' 
}: { 
  command: string; 
  label: string; 
  icon: string;
  variant?: 'primary' | 'success' | 'danger' | 'warning';
}) {
  const handleClick = async () => {
    try {
      await sendCommand(command);
    } catch (error) {
      alert(`Error: ${error}`);
    }
  };

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
    success: 'bg-green-600 hover:bg-green-700 active:bg-green-800',
    danger: 'bg-red-600 hover:bg-red-700 active:bg-red-800',
    warning: 'bg-yellow-600 hover:bg-yellow-700 active:bg-yellow-800'
  };

  return (
    <button
      onClick={handleClick}
      className={`${variantClasses[variant]} text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3`}
    >
      <span className="text-2xl">{icon}</span>
      <span className="text-lg">{label}</span>
    </button>
  );
}

/**
 * Componente: Toggle Button para control manual
 */
function ToggleButton({ 
  command, 
  label, 
  icon, 
  isActive 
}: { 
  command: string; 
  label: string; 
  icon: string;
  isActive: boolean;
}) {
  const handleToggle = async (value: number) => {
    try {
      await sendCommand(`${command}:${value}`);
    } catch (error) {
      alert(`Error: ${error}`);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow-xl border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <span className="text-white font-semibold">{label}</span>
        </div>
        <div className={`w-4 h-4 rounded-full ${isActive ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => handleToggle(1)}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            isActive 
              ? 'bg-green-600 text-white' 
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          ON
        </button>
        <button
          onClick={() => handleToggle(0)}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
            !isActive 
              ? 'bg-red-600 text-white' 
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
        >
          OFF
        </button>
      </div>
    </div>
  );
}

/**
 * Componente: Input para SET_META
 */
function MetaInput() {
  const handleSetMeta = async () => {
    const input = prompt('Ingrese el nuevo valor de META (pulsos):');
    if (input) {
      const value = parseInt(input);
      if (isNaN(value) || value <= 0) {
        alert('El valor debe ser un número mayor a 0');
        return;
      }
      try {
        await sendCommand(`SET_META:${value}`);
        alert(`META establecida a ${value} pulsos`);
      } catch (error) {
        alert(`Error: ${error}`);
      }
    }
  };

  return (
    <button
      onClick={handleSetMeta}
      className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3 w-full"
    >
      <span className="text-2xl">🎯</span>
      <span className="text-lg">Configurar META</span>
    </button>
  );
}

/**
 * Componente Principal: Dashboard
 */
export default function Dashboard() {
  const { machineState, isLoading, isError, lastUpdate } = useMachineStatus();
  const setMachineState = useClientStore((state) => state.setMachineState);
  const setConnected = useClientStore((state) => state.setConnected);

  useEffect(() => {
    if (machineState) {
      setMachineState(machineState);
      setConnected(true);
    } else if (isError) {
      setConnected(false);
    }
  }, [machineState, isError, setMachineState, setConnected]);

  if (isLoading && !machineState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400 text-lg">Cargando Dashboard...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="bg-red-900/20 border border-red-500 rounded-xl p-8 max-w-md">
          <h2 className="text-red-500 text-2xl font-bold mb-2">⚠️ Error de Conexión</h2>
          <p className="text-gray-300">No se puede conectar con el servidor. Verifica la conexión.</p>
        </div>
      </div>
    );
  }

  const state = machineState || {
    ESTADO: 'DESCONECTADO',
    PULSOS: 0,
    META: 0,
    TANQUE: 0,
    S_BOTELLA: 0,
    S_EMERG: 0,
    M_CINTA: 0,
    M_BOMBA: 0,
    L_VERDE: 0,
    L_ROJO: 0
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                🏭 Dashboard IoT - Planta Embotelladora
              </h1>
              <p className="text-gray-400 mt-2">Sistema de Control y Monitoreo en Tiempo Real</p>
            </div>
            {lastUpdate && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Última actualización:</p>
                <p className="text-sm text-gray-400">{new Date(lastUpdate).toLocaleTimeString('es-ES')}</p>
              </div>
            )}
          </div>
        </header>

        {/* Status Card */}
        <div className="mb-6">
          <StatusCard estado={state.ESTADO} />
        </div>

        {/* Simulación de la Máquina */}
        <div className="mb-6">
          <MachineSimulation state={state} />
        </div>

        {/* Progress Bar - Solo visible durante llenado */}
        {(state.ESTADO === 'LLENANDO' || state.ESTADO === 'BOTELLA_DETECTADA' || state.ESTADO === 'BOTELLA_LLENA') && (
          <div className="mb-6">
            <ProgressBar pulsos={state.PULSOS} meta={state.META} />
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <MetricCard label="Pulsos Actuales" value={state.PULSOS} unit="pulsos" icon="💧" />
          <MetricCard label="Meta de Llenado" value={state.META} unit="pulsos" icon="🎯" />
          <MetricCard label="Nivel del Tanque" value={state.TANQUE} unit="%" icon="🛢️" />
        </div>

        {/* Sensors */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <SensorIndicator label="Sensor de Botella" active={state.S_BOTELLA === 1} />
          <SensorIndicator label="Botón de Emergencia" active={state.S_EMERG === 1} inverted={true} />
        </div>

        {/* Actuadores y LEDs */}
        <div className="bg-gray-800 rounded-xl p-6 shadow-2xl border border-gray-700 mb-6">
          <h3 className="text-gray-400 text-sm font-medium mb-4">Estado de Actuadores</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SensorIndicator label="Motor Cinta" active={state.M_CINTA === 1} />
            <SensorIndicator label="Bomba" active={state.M_BOMBA === 1} />
            <SensorIndicator label="LED Verde" active={state.L_VERDE === 1} />
            <SensorIndicator label="LED Rojo" active={state.L_ROJO === 1} />
          </div>
        </div>

        {/* Control Panel */}
        <div className="bg-gray-800 rounded-xl p-8 shadow-2xl border border-gray-700 mb-6">
          <h2 className="text-2xl font-bold mb-6 text-center">Panel de Control del Sistema</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <ControlButton command="START" label="Iniciar" icon="▶️" variant="success" />
            <ControlButton command="STOP" label="Detener" icon="⏹️" variant="danger" />
            <ControlButton command="RESUME" label="Reanudar" icon="⏯️" variant="warning" />
          </div>
          <MetaInput />
        </div>

        {/* Control Manual de Actuadores */}
        <div className="bg-gray-800 rounded-xl p-8 shadow-2xl border border-gray-700 mb-6">
          <h2 className="text-2xl font-bold mb-6 text-center">Control Manual de Actuadores</h2>
          <p className="text-gray-400 text-sm text-center mb-6">⚠️ Solo funciona en modo PAUSA_REMOTA o BUSCANDO_BOTELLA</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ToggleButton command="MANUAL_CINTA" label="Motor Cinta" icon="⚙️" isActive={state.M_CINTA === 1} />
            <ToggleButton command="MANUAL_BOMBA" label="Bomba" icon="💧" isActive={state.M_BOMBA === 1} />
            <ToggleButton command="MANUAL_LED_G" label="LED Verde" icon="🟢" isActive={state.L_VERDE === 1} />
            <ToggleButton command="MANUAL_LED_R" label="LED Rojo" icon="🔴" isActive={state.L_ROJO === 1} />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-gray-500 text-sm">
          <div className="flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isError ? 'bg-red-500' : 'bg-green-500'} animate-pulse`}></div>
            <span>{isError ? 'Desconectado' : 'Conectado'}</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
