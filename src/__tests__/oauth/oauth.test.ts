import { describe, it, expect, beforeEach } from '@jest/globals';
import { findOAuthAccount, findUserByEmail, linkOAuthAccount, validateCompanyCode } from '@/lib/oauth';

describe('OAuth Helper Functions', () => {
  beforeEach(async () => {
    // Clean up test data
    await sql`DELETE FROM oauth_accounts WHERE provider = 'test'`;
  });

  describe('findOAuthAccount', () => {
    it('should return null for non-existent OAuth account', async () => {
      const result = await findOAuthAccount('google', 'nonexistent');
      expect(result).toBeNull();
    });

    it('should find existing OAuth account', async () => {
      // First create a test account
      const [user] = await sql`INSERT INTO users (email, email_hash, password_hash, company_id)
        VALUES ('test@example.com', 'hash', 'password', 'test-company-id')
        RETURNING id`;

      await linkOAuthAccount(user.id, {
        provider: 'google',
        provider_user_id: 'test-google-id',
        email: 'test@example.com'
      });

      const result = await findOAuthAccount('google', 'test-google-id');
      expect(result).not.toBeNull();
      expect(result?.provider).toBe('google');
      expect(result?.provider_user_id).toBe('test-google-id');
    });
  });

  describe('validateCompanyCode', () => {
    it('should return null for invalid company code', async () => {
      const result = await validateCompanyCode('INVALID');
      expect(result).toBeNull();
    });

    it('should validate existing company code', async () => {
      const [company] = await sql`INSERT INTO companies (code, name)
        VALUES ('TEST123', 'Test Company')
        RETURNING code`;

      const result = await validateCompanyCode('TEST123');
      expect(result).not.toBeNull();
      expect(result?.code).toBe('TEST123');
    });
  });
});