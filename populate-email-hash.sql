-- Generate email_hash for jpveneracion@gmail.com
-- This uses SHA-256 hash of the lowercase email for authentication

UPDATE users
SET email_hash = encode(digest(LOWER(email), 'sha256'), 'hex')
WHERE LOWER(email) = 'jpveneracion@gmail.com';

-- Verify the update
SELECT id, email, email_hash,
       CASE WHEN email_hash IS NOT NULL THEN '✓ Hash populated' ELSE '✗ Hash missing' END as status
FROM users
WHERE LOWER(email) = 'jpveneracion@gmail.com';