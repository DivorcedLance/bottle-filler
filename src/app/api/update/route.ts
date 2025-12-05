import { NextRequest, NextResponse } from 'next/server';
import { useServerStore, MachineState } from '@/lib/store';

/**
 * POST /api/update
 * Recibe el estado de la máquina desde el Arduino/Python
 * Valida el tipo y actualiza el store en memoria
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar que el body contenga todos los campos requeridos
    const requiredFields = ['ESTADO', 'PULSOS', 'META', 'TANQUE', 'S_BOTELLA', 'S_EMERG'];
    const missingFields = requiredFields.filter(field => !(field in body));
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Campos faltantes: ${missingFields.join(', ')}` 
        },
        { status: 400 }
      );
    }

    // Validar tipos de datos
    if (
      typeof body.ESTADO !== 'string' ||
      typeof body.PULSOS !== 'number' ||
      typeof body.META !== 'number' ||
      typeof body.TANQUE !== 'number' ||
      typeof body.S_BOTELLA !== 'number' ||
      typeof body.S_EMERG !== 'number'
    ) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Tipos de datos incorrectos' 
        },
        { status: 400 }
      );
    }

    const machineState: MachineState = {
      ESTADO: body.ESTADO,
      PULSOS: body.PULSOS,
      META: body.META,
      TANQUE: body.TANQUE,
      S_BOTELLA: body.S_BOTELLA,
      S_EMERG: body.S_EMERG
    };

    // Actualizar el store del servidor
    useServerStore.getState().updateMachineState(machineState);

    return NextResponse.json(
      { 
        success: true, 
        message: 'Estado actualizado correctamente',
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error en /api/update:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al procesar la solicitud' 
      },
      { status: 500 }
    );
  }
}
