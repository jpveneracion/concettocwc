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

    const { id } = await params;
    const promoCodeId = parseInt(id);
    const body = await req.json();
    const { gcash_qr_url, gotyme_qr_url, usage_limit, ...updates } = body;

    // Handle QR code updates separately
    if (gcash_qr_url !== undefined || gotyme_qr_url !== undefined) {
      const updateFields: string[] = [];
      const updateValues: (string | number | boolean | null)[] = [];
      let paramIndex = 1;

      if (gcash_qr_url !== undefined) {
        updateFields.push(`gcash_qr_url = $${paramIndex++}`);
        updateValues.push(gcash_qr_url);
      }

      if (gotyme_qr_url !== undefined) {
        updateFields.push(`gotyme_qr_url = $${paramIndex++}`);
        updateValues.push(gotyme_qr_url);
      }

      if (usage_limit !== undefined) {
        updateFields.push(`usage_limit = $${paramIndex++}`);
        updateValues.push(usage_limit);
      }

      if (updateFields.length > 0) {
        updateValues.push(promoCodeId);
        await sql(
          `UPDATE activation_codes SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
          updateValues
        );
      }
    }

    // Handle other updates using existing function
    if (Object.keys(updates).length > 0) {
      const updateData: { is_active?: boolean; expires_at?: Date; campaign_name?: string; notes?: string } = {};
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      if (updates.expires_at !== undefined) updateData.expires_at = new Date(updates.expires_at);
      if (updates.campaign_name !== undefined) updateData.campaign_name = updates.campaign_name;
      if (updates.notes !== undefined) updateData.notes = updates.notes;

      await updateActivationCode(promoCodeId, updateData);
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

    const { id } = await params;
    const promoCodeId = parseInt(id);
    await deactivateActivationCode(promoCodeId);

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
 * Helper function to get promo code by ID
 */
async function getActivationCodeById(id: number) {
  const result = await sql('SELECT * FROM activation_codes WHERE id = $1', [id]);

  if (result.length === 0) {
    throw new Error('Promo code not found');
  }

  const row = result[0];
  return {
    id: row.id,
    code: row.code,
    discount_percent: parseFloat(row.discount_percent),
    applicable_plans: JSON.parse(row.applicable_plans),
    gcash_qr_url: row.gcash_qr_url,
    gotyme_qr_url: row.gotyme_qr_url,
    usage_limit: row.usage_limit,
    current_usage: row.current_usage,
    expires_at: row.expires_at,
    is_active: row.is_active,
    campaign_name: row.campaign_name,
    notes: row.notes,
    created_at: row.created_at
  };
}