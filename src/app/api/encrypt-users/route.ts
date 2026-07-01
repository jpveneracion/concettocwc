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

    // Get all users with plaintext but no encryption (company-wide for admin)
    const users = await sql`
      SELECT id, email, name
      FROM users
      WHERE company_id = ${session.companyId}
        AND (email_encrypted IS NULL OR name_encrypted IS NULL)
        AND (email IS NOT NULL OR name IS NOT NULL)
    `;

    let encrypted = 0;
    let verified = 0;
    const errors: Array<{ recordId: string; field: string; message: string }> = [];
    const userIds: string[] = [];

    for (const user of users) {
      try {
        const emailEncrypted = user.email ? encryptPII(user.email) : null;
        const nameEncrypted = user.name ? encryptPII(user.name) : null;

        await sql`
          UPDATE users
          SET email_encrypted = ${emailEncrypted},
              name_encrypted = ${nameEncrypted}
          WHERE id = ${user.id}
        `;

        encrypted++;

        // Verify encryption by decrypting and comparing
        let emailVerified = false;
        let nameVerified = false;

        try {
          if (user.email && emailEncrypted) {
            const emailDecrypted = decryptPII(emailEncrypted);
            emailVerified = emailDecrypted === user.email;
          } else if (!user.email) {
            emailVerified = true;
          }

          if (user.name && nameEncrypted) {
            const nameDecrypted = decryptPII(nameEncrypted);
            nameVerified = nameDecrypted === user.name;
          } else if (!user.name) {
            nameVerified = true;
          }
        } catch (decryptErr) {
          console.error(`Decryption verification failed for user ${user.id}:`, decryptErr);
        }

        if (!emailVerified || !nameVerified) {
          errors.push({
            recordId: user.id,
            field: !emailVerified ? 'email' : 'name',
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
        await sql`
          UPDATE users
          SET email = NULL,
              name = NULL
          WHERE id = ANY(${userIds}::uuid[])
        `;
        deleted = userIds.length;
      } catch (err) {
        console.error('Failed to delete plaintext:', err);
        return NextResponse.json({
          success: false,
          encrypted,
          verified,
          deleted: 0,
          errors: [
            {
              recordId: 'batch',
              field: 'deletion',
              message: 'Encryption verified but failed to delete plaintext columns',
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
