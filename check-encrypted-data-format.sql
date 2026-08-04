-- Check the format of encrypted customer names in the database
SELECT
  id,
  quote_number,
  customer_name,
  customer_name_encrypted,
  -- Get the raw bytea representation
  encode(customer_name_encrypted, 'hex') as hex_format,
  encode(customer_name_encrypted, 'base64') as base64_format,
  -- Get the length
  length(customer_name_encrypted) as bytea_length,
  -- Sample of functions output
  (row_to_json(row(customer_name_encrypted))::json->>'customer_name_encrypted') as json_serialized
FROM quotes
WHERE customer_name_encrypted IS NOT NULL
LIMIT 1;