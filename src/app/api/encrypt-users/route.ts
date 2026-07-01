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

    // Get all users that need encryption or have plaintext that needs deletion
    const users = await sql`
      SELECT id, email, email_encrypted
      FROM users
      WHERE company_id = ${session.companyId}
        AND (
          -- Need encryption: encrypted column is NULL
          email_encrypted IS NULL
          OR
          -- Need plaintext deletion: encrypted exists but plaintext still exists
          (email_encrypted IS NOT NULL AND email IS NOT NULL)
        )
    `;

    let encrypted = 0;
    let verified = 0;
    const errors: Array<{ recordId: string; field: string; message: string }> = [];
    const userIds: string[] = [];

    for (const user of users) {
      try {
        const needsEncryption = !user.email_encrypted;

        let emailEncrypted = user.email_encrypted;

        if (needsEncryption) {
          emailEncrypted = user.email ? encryptPII(user.email) : null;

          await sql`
            UPDATE users
            SET email_encrypted = ${emailEncrypted}::bytea
            WHERE id = ${user.id}
          `;

          encrypted++;
        } else {
          // Already encrypted, just counting as verified (failed deletion retry)
        }

        // Verify encryption by decrypting and comparing
        let emailVerified = false;

        try {
          if (user.email && emailEncrypted) {
            const emailDecrypted = decryptPII(emailEncrypted);
            emailVerified = emailDecrypted === user.email;
          } else if (!user.email) {
            emailVerified = true;
          }
        } catch (decryptErr) {
          console.error(`Decryption verification failed for user ${user.id}:`, decryptErr);
        }

        if (!emailVerified) {
          errors.push({
            recordId: user.id,
            field: 'email',
            message: 'Verification failed: decrypted data does not match original',
          });
        } else {
          verified++;
          userIds.push(user.id);
        }
      } catch (err) {
        console.error(`Failed to encrypt user ${user.id}:`, err);
        errors.push({
          recordId: user.id,
          field: 'encryption',
          message: (err as Error).message,
        });
      }
    }

    // Only delete plaintext if ALL verifications passed
    let deleted = 0;
    if (errors.length === 0 && userIds.length > 0) {
      try {
        const result = await sql`
          UPDATE users
          SET email = NULL
          WHERE id = ANY(${userIds}::uuid[])
          RETURNING id
        `;
        deleted = result.length;
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
    console.error('Encrypt users error:', err);
    return NextResponse.json({ error: 'Failed to encrypt users' }, { status: 500 });
  }
}
