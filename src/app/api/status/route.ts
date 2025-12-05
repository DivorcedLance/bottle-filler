import { NextResponse } from 'next/server';
import { useServerStore } from '@/lib/store';

/**
 * GET /api/status
 * Devuelve el estado actual de la máquina al Frontend
 */
export async function GET() {
  try {
    const { machineState, lastUpdate } = useServerStore.getState();

    return NextResponse.json(
      {
        success: true,
        data: machineState,
        lastUpdate: lastUpdate?.toISOString() || null,
        timestamp: new Date().toISOString()
      },
      { 
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0'
        }
      }
    );

  } catch (error) {
    console.error('Error en /api/status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al obtener el estado' 
      },
      { status: 500 }
    );
  }
}
