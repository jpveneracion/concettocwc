import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { updateActivationCode, deactivateActivationCode, getActivationCode } from '@/lib/activation';
import { sql } from '@/lib/db';

/**
 * PATCH /api/admin/promo-codes/[id]
 *
 * Update promo code including QR codes (admin only)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await requireAdmin(session.userId);

    const rlsContext = {
      companyId: session.companyId,
      userRole: (session.role || (session.isAdmin ? 'superadmin' : 'admin')) as 'user' | 'admin' | 'superadmin',
    };

    const { id } = await params;
    const promoCodeId = parseInt(id);
    const body = await req.json();
    const { gcash_qr_url, gotyme_qr_url, usage_limit, ...updates } = body;

    // Handle QR code updates using SECURITY DEFINER function
    if (gcash_qr_url !== undefined || gotyme_qr_url !== undefined || usage_limit !== undefined) {
      const result = await sql(
        'SELECT update_activation_code_qr_urls($1::int, $2::text, $3::text, $4::int) as update_result',
        [promoCodeId, gcash_qr_url || null, gotyme_qr_url || null, usage_limit || null]
      );
    }

    // Handle other updates using existing function
    if (Object.keys(updates).length > 0) {
      const updateData: { is_active?: boolean; expires_at?: Date; campaign_name?: string; notes?: string } = {};
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      if (updates.expires_at !== undefined) updateData.expires_at = new Date(updates.expires_at);
      if (updates.campaign_name !== undefined) updateData.campaign_name = updates.campaign_name;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      await updateActivationCode(promoCodeId, updateData, rlsContext);
    }

    const updatedPromoCode = await getActivationCodeById(promoCodeId);

    return NextResponse.json({
      success: true,
      promoCode: updatedPromoCode,
      message: 'Promo code updated successfully'
    });

  } catch (error) {
    console.error('Update promo code error:', error);

    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update promo code' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/promo-codes/[id]
 *
 * Deactivate promo code (admin only)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await requireAdmin(session.userId);

    const rlsContext = {
      companyId: session.companyId,
      userRole: (session.role || (session.isAdmin ? 'superadmin' : 'admin')) as 'user' | 'admin' | 'superadmin',
    };

    const { id } = await params;
    const promoCodeId = parseInt(id);
    await deactivateActivationCode(promoCodeId, rlsContext);

    return NextResponse.json({
      success: true,
      message: 'Promo code deactivated successfully'
    });

  } catch (error) {
    console.error('Deactivate promo code error:', error);

    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to deactivate promo code' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to get promo code by ID using SECURITY DEFINER function
 */
async function getActivationCodeById(id: number) {
  const result = await sql('SELECT get_activation_code_by_id($1::int) as promo_code', [id]);

  if (result.length === 0) {
    throw new Error('Promo code not found');
  }

  // Driver auto-parses JSONB to object, so use directly if already object
  const promoCodeData = typeof result[0].promo_code === 'string'
    ? JSON.parse(result[0].promo_code)
    : result[0].promo_code;
  return {
    id: promoCodeData.id,
    code: promoCodeData.code,
    discount_percent: promoCodeData.discount_percent,
    applicable_plans: promoCodeData.applicable_plans,
    gcash_qr_url: promoCodeData.gcash_qr_url,
    gotyme_qr_url: promoCodeData.gotyme_qr_url,
    usage_limit: promoCodeData.usage_limit,
    current_usage: promoCodeData.current_usage,
    expires_at: promoCodeData.expires_at,
    is_active: promoCodeData.is_active,
    campaign_name: promoCodeData.campaign_name,
    notes: promoCodeData.notes,
    created_at: promoCodeData.created_at
  };
}