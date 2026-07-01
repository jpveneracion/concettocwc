import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { sql } from '@/lib/db';
import { encryptPII, decryptPII } from '@/lib/crypto';

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all quotes that need encryption or have plaintext that needs deletion
    const quotes = await sql`
      SELECT id, customer_name, customer_address, customer_name_encrypted, customer_address_encrypted
      FROM quotes
      WHERE company_id = ${session.companyId}
        AND (
          -- Need encryption: encrypted columns are NULL
          (customer_name_encrypted IS NULL OR customer_address_encrypted IS NULL)
          OR
          -- Need plaintext deletion: encrypted exists but plaintext still exists
          ((customer_name_encrypted IS NOT NULL OR customer_address_encrypted IS NOT NULL)
           AND (customer_name IS NOT NULL OR customer_address IS NOT NULL))
        )
    `;

    let encrypted = 0;
    let verified = 0;
    const errors: Array<{ recordId: string; field: string; message: string }> = [];
    const quoteIds: string[] = [];

    for (const quote of quotes) {
      try {
        const needsEncryption = !quote.customer_name_encrypted || !quote.customer_address_encrypted;

        let nameEncrypted = quote.customer_name_encrypted;
        let addressEncrypted = quote.customer_address_encrypted;

        if (needsEncryption) {
          nameEncrypted = quote.customer_name ? encryptPII(quote.customer_name) : null;
          addressEncrypted = quote.customer_address ? encryptPII(quote.customer_address) : null;

          await sql`
            UPDATE quotes
            SET customer_name_encrypted = ${nameEncrypted}::bytea,
                customer_address_encrypted = ${addressEncrypted}::bytea
            WHERE id = ${quote.id}
          `;

          encrypted++;
        } else {
          // Already encrypted, just counting as verified (failed deletion retry)
        }

        // Verify encryption by decrypting and comparing
        let nameVerified = false;
        let addressVerified = false;

        try {
          if (quote.customer_name && nameEncrypted) {
            const nameDecrypted = decryptPII(nameEncrypted);
            nameVerified = nameDecrypted === quote.customer_name;
          } else if (!quote.customer_name) {
            nameVerified = true;
          }

          if (quote.customer_address && addressEncrypted) {
            const addressDecrypted = decryptPII(addressEncrypted);
            addressVerified = addressDecrypted === quote.customer_address;
          } else if (!quote.customer_address) {
            addressVerified = true;
          }
        } catch (decryptErr) {
          console.error(`Decryption verification failed for quote ${quote.id}:`, decryptErr);
        }

        if (!nameVerified || !addressVerified) {
          errors.push({
            recordId: quote.id,
            field: !nameVerified ? 'customer_name' : 'customer_address',
            message: 'Verification failed: decrypted data does not match original',
          });
        } else {
          verified++;
          quoteIds.push(quote.id);
        }
      } catch (err) {
        console.error(`Failed to encrypt quote ${quote.id}:`, err);
        errors.push({
          recordId: quote.id,
          field: 'encryption',
          message: (err as Error).message,
        });
      }
    }

    // Only delete plaintext if ALL verifications passed
    let deleted = 0;
    if (errors.length === 0 && quoteIds.length > 0) {
      try {
        console.log('Attempting to delete plaintext for quotes:', quoteIds);
        const result = await sql`
          UPDATE quotes
          SET customer_name = NULL,
              customer_address = NULL
          WHERE id = ANY(${quoteIds}::uuid[])
            AND customer_name_encrypted IS NOT NULL
            AND customer_address_encrypted IS NOT NULL
          RETURNING id
        `;
        deleted = result.length;
        console.log('Deleted plaintext for', deleted, 'quotes');
      } catch (err) {
        console.error('Failed to delete plaintext:', err);
        return NextResponse.json({
          success: false,
          encrypted,
          verified,
          deleted,
          errors: [
            {
              recordId: 'batch',
              field: 'deletion',
              message: (err as Error).message,
            },
          ],
        });
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      encrypted,
      verified,
      deleted,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Encrypt quotes error:', err);
    return NextResponse.json({ error: 'Failed to encrypt quotes' }, { status: 500 });
  }
}
