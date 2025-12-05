import { NextRequest, NextResponse } from 'next/server';
import { useServerStore } from '@/lib/store';

/**
 * POST /api/commands
 * Recibe comandos del Frontend y los agrega a la cola
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.command || typeof body.command !== 'string') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Comando inválido' 
        },
        { status: 400 }
      );
    }

    const validCommands = ['START', 'STOP', 'RESUME'];
    const validManualCommands = ['MANUAL_CINTA', 'MANUAL_BOMBA', 'MANUAL_LED_G', 'MANUAL_LED_R'];
    let command = body.command.toUpperCase();

    // Verificar si es un comando SET_META
    if (command.startsWith('SET_META:')) {
      const metaValue = command.substring(9);
      const metaNumber = parseInt(metaValue);
      if (isNaN(metaNumber) || metaNumber <= 0) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Valor de META inválido. Debe ser un número mayor a 0' 
          },
          { status: 400 }
        );
      }
      // Formato completo para Arduino
      const fullCommand = `CMD:SET_META:${metaNumber}`;
      useServerStore.getState().addCommand(fullCommand);
      return NextResponse.json(
        { 
          success: true, 
          message: `Comando ${fullCommand} agregado a la cola`,
          command: fullCommand
        },
        { status: 200 }
      );
    }

    // Verificar si es comando manual (formato: MANUAL_CINTA:1 o MANUAL_BOMBA:0)
    let fullCommand = '';
    const manualMatch = command.match(/^(MANUAL_[A-Z_]+):(0|1)$/);
    if (manualMatch) {
      const [, manualCmd, value] = manualMatch;
      if (!validManualCommands.includes(manualCmd)) {
        return NextResponse.json(
          { success: false, error: `Comando manual no válido: ${manualCmd}` },
          { status: 400 }
        );
      }
      fullCommand = `CMD:${manualCmd}:${value}`;
    } else if (validCommands.includes(command)) {
      fullCommand = `CMD:${command}`;
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: `Comando no válido. Comandos: ${validCommands.join(', ')}, ${validManualCommands.map(c => c + ':0/1').join(', ')}, SET_META:<valor>` 
        },
        { status: 400 }
      );
    }

    useServerStore.getState().addCommand(fullCommand);

    return NextResponse.json(
      { 
        success: true, 
        message: `Comando ${fullCommand} agregado a la cola`,
        command: fullCommand
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error en POST /api/commands:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al procesar el comando' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/commands
 * Usado por el script de Python
 * Devuelve el siguiente comando pendiente y lo elimina de la cola
 */
export async function GET() {
  try {
    const store = useServerStore.getState();
    const nextCommand = store.getNextCommand();

    if (nextCommand) {
      // Limpiar el comando de la cola inmediatamente
      store.clearCommand();
      
      return NextResponse.json(
        { 
          success: true,
          command: nextCommand,
          timestamp: new Date().toISOString()
        },
        { 
          status: 200,
          headers: {
            'Cache-Control': 'no-store, max-age=0'
          }
        }
      );
    } else {
      return NextResponse.json(
        { 
          success: true,
          command: null,
          message: 'No hay comandos pendientes'
        },
        { 
          status: 200,
          headers: {
            'Cache-Control': 'no-store, max-age=0'
          }
        }
      );
    }

  } catch (error) {
    console.error('Error en GET /api/commands:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al obtener comandos' 
      },
      { status: 500 }
    );
  }
}
