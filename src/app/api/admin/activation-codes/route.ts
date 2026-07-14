// src/app/api/admin/activation-codes/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import {
  createActivationCode,
  listActivationCodes,
  deactivateActivationCode
} from '@/lib/activation';
import {
  GenerateActivationCodeRequest
} from '@/types/subscription';

// GET - List activation codes
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use new permission system that checks database roles
    await requireAdmin(session.userId);

    // Admin access verified - only admin users can reach this point

    const searchParams = req.nextUrl.searchParams;
    const filters = {
      is_active: searchParams.get('is_active') === 'true' ? true :
                 searchParams.get('is_active') === 'false' ? false :
                 undefined,
      used_by: searchParams.get('used_by') ? parseInt(searchParams.get('used_by')!) : undefined,
      campaign_name: searchParams.get('campaign_name') || undefined
    };

    const codes = await listActivationCodes(filters);

    return NextResponse.json({ codes });
  } catch (error) {
    console.error('Error listing activation codes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Generate new activation code
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use new permission system that checks database roles
    await requireAdmin(session.userId);

    // Admin access verified - only admin users can generate codes

    const body: GenerateActivationCodeRequest = await req.json();
    const userId = session.userId;

    // Validate required fields
    if (!body.discount_percent || !body.applicable_plans.length ||
        !body.payment_amount || !body.payment_method || !body.payment_reference) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const activationCode = await createActivationCode(body, userId);

    return NextResponse.json({
      success: true,
      code: activationCode
    });
  } catch (error) {
    console.error('Error creating activation code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate activation code
export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use new permission system that checks database roles
    await requireAdmin(session.userId);

    // Admin access verified - only admin users can deactivate codes

    const searchParams = req.nextUrl.searchParams;
    const codeId = searchParams.get('id');

    if (!codeId) {
      return NextResponse.json(
        { error: 'Code ID is required' },
        { status: 400 }
      );
    }

    await deactivateActivationCode(parseInt(codeId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deactivating code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update activation code
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use new permission system that checks database roles
    await requireAdmin(session.userId);

    // Admin access verified - only admin users can update codes

    const body = await req.json();
    const { id, is_active, expires_at, campaign_name, notes } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Code ID is required' },
        { status: 400 }
      );
    }

    // Import the update function
    const { updateActivationCode } = await import('@/lib/activation');

    await updateActivationCode(id, {
      is_active,
      expires_at: expires_at ? new Date(expires_at) : undefined,
      campaign_name,
      notes
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating activation code:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}