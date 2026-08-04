const { neon } = require('@neondatabase/serverless');

require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function applyMigrationDirect() {
  console.log('🔒 Applying quote_items RLS migration directly...\n');

  try {
    // First, create the table
    console.log('📋 Creating quote_items table...');
    await sql`
      CREATE TABLE IF NOT EXISTS quote_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        location TEXT,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        product_code TEXT,
        product_collection TEXT,
        product_description TEXT,
        unit TEXT NOT NULL DEFAULT 'in' CHECK (unit IN ('in', 'cm')),
        is_fixed BOOLEAN NOT NULL DEFAULT true,
        measured_width NUMERIC(10,2) NOT NULL DEFAULT 0,
        measured_drop NUMERIC(10,2) NOT NULL DEFAULT 0,
        final_width NUMERIC(10,2) NOT NULL DEFAULT 0,
        final_drop NUMERIC(10,2) NOT NULL DEFAULT 0,
        area_sqft NUMERIC(10,4) NOT NULL DEFAULT 0,
        minimum_applied BOOLEAN NOT NULL DEFAULT false,
        retail_price_sqft NUMERIC(10,2) NOT NULL DEFAULT 0,
        supplier_cost_sqft NUMERIC(10,2) NOT NULL DEFAULT 0,
        retail_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
        supplier_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    console.log('✅ Table created successfully');

    // Enable RLS
    console.log('🔒 Enabling RLS...');
    await sql`ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY`;
    console.log('✅ RLS enabled');

    // Create policies one by one
    console.log('🛡️  Creating RLS policies...');

    // 1. Tenant isolation
    await sql`
      CREATE POLICY quote_items_tenant_isolation ON quote_items
      FOR ALL
      USING (
        quote_id IN (
          SELECT id FROM quotes
          WHERE company_id = get_current_company_id()
        )
        OR is_current_user_superadmin()
      )
      WITH CHECK (
        quote_id IN (
          SELECT id FROM quotes
          WHERE company_id = get_current_company_id()
        )
        OR is_current_user_superadmin()
      )
    `;
    console.log('   ✅ Tenant isolation policy');

    // 2. Admin access
    await sql`
      CREATE POLICY quote_items_admin_access ON quote_items
      FOR ALL
      USING (
        is_current_user_admin()
        AND quote_id IN (
          SELECT id FROM quotes
          WHERE company_id = get_current_company_id()
        )
      )
      WITH CHECK (
        is_current_user_admin()
        AND quote_id IN (
          SELECT id FROM quotes
          WHERE company_id = get_current_company_id()
        )
      )
    `;
    console.log('   ✅ Admin access policy');

    // 3. Read-only access
    await sql`
      CREATE POLICY quote_items_read_only_access ON quote_items
      FOR SELECT
      USING (
        quote_id IN (
          SELECT id FROM quotes
          WHERE company_id = get_current_company_id()
        )
        OR is_current_user_superadmin()
      )
    `;
    console.log('   ✅ Read-only access policy');

    // 4. Insert protection
    await sql`
      CREATE POLICY quote_items_insert_protection ON quote_items
      FOR INSERT
      WITH CHECK (
        quote_id IN (
          SELECT id FROM quotes
          WHERE company_id = get_current_company_id()
        )
        OR is_current_user_superadmin()
      )
    `;
    console.log('   ✅ Insert protection policy');

    // 5. Update protection
    await sql`
      CREATE POLICY quote_items_update_protection ON quote_items
      FOR UPDATE
      USING (
        quote_id IN (
          SELECT id FROM quotes
          WHERE company_id = get_current_company_id()
        )
        OR is_current_user_superadmin()
      )
      WITH CHECK (
        quote_id = (SELECT quote_id FROM quote_items WHERE id = quote_items.id)
        OR is_current_user_superadmin()
      )
    `;
    console.log('   ✅ Update protection policy');

    // 6. Delete protection
    await sql`
      CREATE POLICY quote_items_delete_protection ON quote_items
      FOR DELETE
      USING (
        quote_id IN (
          SELECT id FROM quotes
          WHERE company_id = get_current_company_id()
        )
        OR is_current_user_superadmin()
      )
    `;
    console.log('   ✅ Delete protection policy');

    // 7. Superadmin access
    await sql`
      CREATE POLICY quote_items_superadmin_full_access ON quote_items
      FOR ALL
      USING (
        is_current_user_superadmin()
      )
      WITH CHECK (
        is_current_user_superadmin()
      )
    `;
    console.log('   ✅ Superadmin access policy');

    // 8. Quote ID immutability
    await sql`
      CREATE POLICY quote_items_quote_id_immutable ON quote_items
      FOR UPDATE
      WITH CHECK (
        quote_id = (SELECT quote_id FROM quote_items WHERE id = quote_items.id)
      )
    `;
    console.log('   ✅ Quote ID immutability policy');

    // 9. Financial protection
    await sql`
      CREATE POLICY quote_items_financial_protection ON quote_items
      FOR UPDATE
      USING (
        (supplier_cost_sqft = (SELECT supplier_cost_sqft FROM quote_items WHERE id = quote_items.id)
         AND supplier_amount = (SELECT supplier_amount FROM quote_items WHERE id = quote_items.id))
        OR is_current_user_superadmin()
      )
      WITH CHECK (
        supplier_cost_sqft = (SELECT supplier_cost_sqft FROM quote_items WHERE id = quote_items.id)
        AND supplier_amount = (SELECT supplier_amount FROM quote_items WHERE id = quote_items.id)
        AND COALESCE(supplier_cost_sqft, 0) = COALESCE((SELECT supplier_cost_sqft FROM quote_items WHERE id = quote_items.id), 0)
        AND COALESCE(supplier_amount, 0) = COALESCE((SELECT supplier_amount FROM quote_items WHERE id = quote_items.id), 0)
      )
    `;
    console.log('   ✅ Financial protection policy');

    // Create indexes
    console.log('📊 Creating indexes...');
    await sql`CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_quote_items_company_indirect ON quote_items(quote_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_quote_items_quote_costs ON quote_items(quote_id, supplier_amount, retail_amount)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_quote_items_quote_margins ON quote_items(quote_id, retail_amount, supplier_amount)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_quote_items_quote_order ON quote_items(quote_id, sort_order)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_quote_items_product_id ON quote_items(product_id) WHERE product_id IS NOT NULL`;
    console.log('   ✅ All indexes created');

    console.log('\n✅ Migration applied successfully!');
    console.log('🛡️  9 RLS policies created');
    console.log('📊 6 Performance indexes created');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

applyMigrationDirect().then(() => {
  console.log('\n✅ Migration process completed successfully');
  process.exit(0);
}).catch(err => {
  console.error('❌ Script error:', err.message);
  process.exit(1);
});