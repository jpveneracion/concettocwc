import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    console.log('=== Testing Encrypted Data Format ===');

    // Get a sample quote with encrypted data
    const directResult = await sql(`
      SELECT
        id,
        customer_name_encrypted,
        quote_number,
        company_id
      FROM quotes
      WHERE customer_name_encrypted IS NOT NULL
      LIMIT 1
    `);

    if (directResult.length === 0) {
      return NextResponse.json({
        error: 'No quotes with encrypted data found',
        suggestion: 'Create a quote with customer name first'
      });
    }

    const quote = directResult[0];

    // Test using SECURITY DEFINER function
    const jsonResult = await sql(`
      SELECT
        data->>'customer_name_encrypted' as encrypted_field,
        data->>'id' as quote_id,
        data->>'quote_number' as quote_number
      FROM get_company_quotes($1::uuid) as data
      WHERE (data->>'id')::text = $2::text
      LIMIT 1
    `, [quote.company_id, quote.id]);

    const analysis = {
      direct_database_access: {
        type: typeof quote.customer_name_encrypted,
        length: quote.customer_name_encrypted?.length,
        preview: quote.customer_name_encrypted?.substring(0, 100),
        full_data: quote.customer_name_encrypted
      },
      security_definer_function: jsonResult.length > 0 ? {
        type: typeof jsonResult[0].encrypted_field,
        length: jsonResult[0].encrypted_field?.length,
        preview: jsonResult[0].encrypted_field?.substring(0, 100),
        full_data: jsonResult[0].encrypted_field
      } : null
    };

    console.log('📊 Encryption Format Analysis:', JSON.stringify(analysis, null, 2));

    return NextResponse.json({
      quote_id: quote.id,
      quote_number: quote.quote_number,
      analysis
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Test failed', details: errorMessage },
      { status: 500 }
    );
  }
}