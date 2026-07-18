// src/app/api/health/gateway/route.ts

import { NextResponse } from 'next/server';
import { upsertGatewayHeartbeat, getGatewayStatus } from '@/lib/db';
import type { HeartbeatRequest } from '@/types/payment';

/**
 * POST /api/health/gateway
 *
 * Receives heartbeat pings from MacroDroid to monitor gateway device health
 * Uses same authentication as GCash webhook (GCASH_WEBHOOK_SECRET)
 */
export async function POST(req: Request): Promise<NextResponse> {
  try {
    // 1. Authentication Check - Verify MacroDroid bearer token
    const authHeader = req.headers.get('Authorization');
    const webhookSecret = process.env.GCASH_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('GCASH_WEBHOOK_SECRET environment variable is not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - Missing bearer token' },
        { status: 401 }
      );
    }

    const providedToken = authHeader.substring(7); // Remove 'Bearer ' prefix
    if (providedToken !== webhookSecret) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid bearer token' },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    let body: HeartbeatRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid JSON format' },
        { status: 400 }
      );
    }

    // 3. Validate required fields
    const { device_id } = body;
    if (!device_id || typeof device_id !== 'string' || device_id.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: device_id' },
        { status: 400 }
      );
    }

    // 4. Validate optional fields format
    if (body.battery_level !== undefined) {
      const batteryLevel = Number(body.battery_level);
      if (isNaN(batteryLevel) || batteryLevel < 0 || batteryLevel > 100) {
        return NextResponse.json(
          { error: 'Invalid battery_level - must be between 0 and 100' },
          { status: 400 }
        );
      }
    }

    if (body.macrodroid_version !== undefined && typeof body.macrodroid_version !== 'string') {
      return NextResponse.json(
        { error: 'Invalid macrodroid_version - must be a string' },
        { status: 400 }
      );
    }

    // 5. Get client IP address for monitoring
    const ip_address = req.headers.get('x-forwarded-for')?.split(',')[0] ||
                       req.headers.get('x-real-ip') ||
                       'unknown';

    // 6. Update heartbeat record in database
    const heartbeatData = await upsertGatewayHeartbeat({
      device_id: device_id.trim(),
      status: 'online',
      ip_address,
      battery_level: body.battery_level ? Number(body.battery_level) : undefined,
      macrodroid_version: body.macrodroid_version
    });

    // 7. Return success response with server timestamp
    return NextResponse.json({
      success: true,
      server_time: new Date().toISOString(),
      heartbeat_id: heartbeatData.id,
      message: 'Heartbeat received'
    }, { status: 200 });

  } catch (error) {
    console.error('Gateway heartbeat processing error:', error);

    // Check for JSON parsing errors
    if (error instanceof SyntaxError && error.message.includes('JSON')) {
      return NextResponse.json(
        { error: 'Invalid request format' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/health/gateway
 *
 * Returns current gateway status for admin dashboard polling
 * No authentication required - used for monitoring display
 */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    // 1. Get current gateway status from database
    const status = await getGatewayStatus();

    // 2. Determine status text based on online state and time ago
    let statusText: string;
    if (status.online) {
      statusText = 'online';
    } else if (status.last_ago === Infinity) {
      statusText = 'no_data';
    } else if (status.last_ago < 3600) {
      statusText = 'offline_recent';
    } else {
      statusText = 'offline_extended';
    }

    // 3. Return gateway status response
    return NextResponse.json({
      online: status.online,
      last_ping_seconds_ago: status.last_ago,
      status: statusText
    }, { status: 200 });

  } catch (error) {
    console.error('Gateway status retrieval error:', error);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}