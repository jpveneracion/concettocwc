import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { uploadToPinata, validateScreenshotFile } from '@/lib/pinata';

/**
 * POST /api/admin/upload-qr-code
 *
 * Uploads QR code images to Pinata IPFS (admin only)
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify admin access
    await requireAdmin(session.userId);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const method = formData.get('method') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file
    const validation = validateScreenshotFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Upload to Pinata with QR code metadata
    const uploadResult = await uploadToPinata(file, {
      name: `qr-code-${method}-${Date.now()}`,
      keyvalues: {
        type: 'qr_code',
        payment_method: method,
        uploaded_by: session.userId,
        uploaded_at: new Date().toISOString()
      }
    });

    if (!uploadResult.success || !uploadResult.cid) {
      return NextResponse.json(
        { error: uploadResult.error || 'Failed to upload QR code' },
        { status: 500 }
      );
    }

    // Return the Pinata gateway URL
    const pinataGatewayUrl = process.env.PINATA_GATEWAY_URL || 'https://gateway.pinata.cloud/ipfs/';
    const qrCodeUrl = `${pinataGatewayUrl}${uploadResult.cid}`;

    return NextResponse.json({
      success: true,
      url: qrCodeUrl,
      cid: uploadResult.cid,
      message: 'QR code uploaded successfully'
    });

  } catch (error) {
    console.error('QR code upload error:', error);

    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to upload QR code' },
      { status: 500 }
    );
  }
}