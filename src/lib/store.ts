import { create } from 'zustand';

/**
 * Interface que representa el estado de la máquina embotelladora
 */
export interface MachineState {
  ESTADO: string;
  PULSOS: number;
  META: number;
  TANQUE: number;
  S_BOTELLA: number;
  S_EMERG: number;
  M_CINTA: number;
  M_BOMBA: number;
  L_VERDE: number;
  L_ROJO: number;
}

/**
 * Store global del servidor para persistencia en memoria
 */
interface ServerStore {
  machineState: MachineState;
  commandQueue: string[];
  lastUpdate: Date | null;
  
  updateMachineState: (state: MachineState) => void;
  addCommand: (command: string) => void;
  getNextCommand: () => string | null;
  clearCommand: () => void;
}

/**
 * Estado inicial de la máquina
 */
const initialMachineState: MachineState = {
  ESTADO: "ESPERA",
  PULSOS: 0,
  META: 0,
  TANQUE: 100,
  S_BOTELLA: 0,
  S_EMERG: 0,
  M_CINTA: 0,
  M_BOMBA: 0,
  L_VERDE: 0,
  L_ROJO: 0
};

/**
 * Store del servidor (Singleton en memoria)
 * Este store se mantiene en el servidor de Next.js
 */
export const useServerStore = create<ServerStore>((set, get) => ({
  machineState: initialMachineState,
  commandQueue: [],
  lastUpdate: null,

  updateMachineState: (state: MachineState) => {
    set({
      machineState: state,
      lastUpdate: new Date()
    });
  },

  addCommand: (command: string) => {
    set((state) => ({
      commandQueue: [...state.commandQueue, command]
    }));
  },

  getNextCommand: () => {
    const queue = get().commandQueue;
    return queue.length > 0 ? queue[0] : null;
  },

  clearCommand: () => {
    set((state) => ({
      commandQueue: state.commandQueue.slice(1)
    }));
  }
}));

/**
 * Interface para el estado del cliente (Frontend)
 */
interface ClientStore {
  machineState: MachineState;
  isConnected: boolean;
  
  setMachineState: (state: MachineState) => void;
  setConnected: (connected: boolean) => void;
}

/**
 * Store del cliente (Frontend)
 * Este store se usa en el navegador
 */
export const useClientStore = create<ClientStore>((set) => ({
  machineState: initialMachineState,
  isConnected: false,

  setMachineState: (state: MachineState) => {
    set({ machineState: state, isConnected: true });
  },

  setConnected: (connected: boolean) => {
    set({ isConnected: connected });
  }
}));
