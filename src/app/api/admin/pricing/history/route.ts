import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { requireAdmin } from '@/lib/permissions';
import { getPricingHistory } from '@/lib/pricing-service';
import type { PricingHistoryEntry } from '@/lib/pricing-service';

/**
 * GET /api/admin/pricing/history
 *
 * Returns paginated pricing change history
 * Query parameters:
 * - limit: number of entries to return (default: 100)
 * - offset: number of entries to skip (default: 0)
 * - startDate: optional start date for filtering (ISO string)
 * - endDate: optional end date for filtering (ISO string)
 */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await requireAdmin(session.userId);

    const { searchParams } = new URL(req.url);

    // Parse pagination parameters
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    const limit = limitParam ? parseInt(limitParam, 10) : 100;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    // Validate pagination parameters
    if (isNaN(limit) || limit < 1 || limit > 1000) {
      return NextResponse.json(
        { error: 'Invalid limit parameter. Must be between 1 and 1000' },
        { status: 400 }
      );
    }

    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        { error: 'Invalid offset parameter. Must be >= 0' },
        { status: 400 }
      );
    }

    // Build options object
    const options: {
      limit: number;
      offset: number;
      startDate?: Date;
      endDate?: Date;
    } = {
      limit,
      offset
    };

    // Add date filters if provided
    if (startDateParam) {
      const startDate = new Date(startDateParam);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid startDate parameter. Must be a valid ISO date string' },
          { status: 400 }
        );
      }
      options.startDate = startDate;
    }

    if (endDateParam) {
      const endDate = new Date(endDateParam);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid endDate parameter. Must be a valid ISO date string' },
          { status: 400 }
        );
      }
      options.endDate = endDate;
    }

    // Validate date range: startDate must be <= endDate when both are provided
    if (options.startDate && options.endDate && options.startDate > options.endDate) {
      return NextResponse.json(
        { error: 'Invalid date range: startDate must be less than or equal to endDate' },
        { status: 400 }
      );
    }

    // Fetch history entries
    const historyEntries = await getPricingHistory(options);

    return NextResponse.json({
      success: true,
      data: {
        entries: historyEntries,
        pagination: {
          limit,
          offset,
          count: historyEntries.length
        }
      }
    });

  } catch (error) {
    console.error('Get pricing history error:', error);

    if (error instanceof Error && error.message.includes('Forbidden')) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to retrieve pricing history' },
      { status: 500 }
    );
  }
}
