const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function exploreDatabaseStructure() {
  console.log('🔍 Exploring Complete Database Structure for Concetto Window Coverings...\n');

  try {
    // 1. List all tables
    console.log('📋 ALL TABLES:');
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    tables.forEach(t => console.log(`  - ${t.table_name}`));
    console.log(`Total: ${tables.length} tables\n`);

    // 2. Check for existing RLS
    console.log('🔒 CURRENT RLS STATUS:');
    const rlsStatus = await sql(`
      SELECT
        schemaname,
        tablename,
        rowsecurity as rls_enabled,
        forcerowsecurity as rls_forced
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    rlsStatus.forEach(t => {
      const status = t.rls_enabled ? '✅ ENABLED' : '❌ DISABLED';
      console.log(`  ${t.tablename}: ${status}${t.rls_forced ? ' (FORCED)' : ''}`);
    });
    console.log('');

    // 3. Detailed table structure analysis
    console.log('🔧 DETAILED TABLE STRUCTURES:');

    for (const table of tables) {
      const tableName = table.table_name;
      console.log(`\n  ┌─ ${tableName}`);

      // Get column details
      const columns = await sql(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      if (columns.length > 0) {
        console.log('  │ Columns:');
        columns.forEach(col => {
          const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
          const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
          const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
          const precision = col.numeric_precision && col.numeric_scale ? `(${col.numeric_precision},${col.numeric_scale})` : '';

          console.log(`  │   - ${col.column_name}: ${col.data_type}${length}${precision} ${nullable}${defaultVal}`);
        });
      }

      // Get primary keys
      const primaryKeys = await sql(`
        SELECT a.attname AS column_name
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = $1::regclass AND i.indisprimary
      `, [tableName]);

      if (primaryKeys.length > 0) {
        console.log('  │ Primary Key:', primaryKeys.map(pk => pk.column_name).join(', '));
      }

      // Get foreign keys
      const foreignKeys = await sql(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name,
          tc.constraint_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = $1
      `, [tableName]);

      if (foreignKeys.length > 0) {
        console.log('  │ Foreign Keys:');
        foreignKeys.forEach(fk => {
          console.log(`  │   - ${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name}`);
        });
      }

      // Get indexes
      const indexes = await sql(`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = $1
      `, [tableName]);

      if (indexes.length > 0) {
        console.log('  │ Indexes:', indexes.map(idx => idx.indexname).join(', '));
      }

      // Check for RLS policies
      const policies = await sql(`
        SELECT
          policyname,
          permissive,
          roles,
          cmd,
          substr(qual, 1, 50) as qual_preview
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = $1
        ORDER BY policyname
      `, [tableName]);

      if (policies.length > 0) {
        console.log('  │ RLS Policies:');
        policies.forEach(p => {
          console.log(`  │   - ${p.policyname} (${p.cmd})`);
        });
      }

      console.log('  └─────────────────────────────────');
    }

    // 4. Check data volumes
    console.log('\n📊 DATA VOLUMES:');
    for (const table of tables) {
      try {
        const result = await sql(`SELECT COUNT(*) as count FROM "${table.table_name}"`);
        console.log(`  ${table.table_name}: ${result[0].count} rows`);
      } catch (err) {
        console.log(`  ${table.table_name}: Error counting rows - ${err.message}`);
      }
    }
    console.log('');

    // 5. RLS Policy Analysis
    console.log('🛡️ RLS POLICY ANALYSIS:');
    const allPolicies = await sql(`
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd,
        qual,
        with_check
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname
    `);

    if (allPolicies.length === 0) {
      console.log('  No RLS policies found in database');
    } else {
      const policiesByTable = {};
      allPolicies.forEach(p => {
        if (!policiesByTable[p.tablename]) {
          policiesByTable[p.tablename] = [];
        }
        policiesByTable[p.tablename].push(p);
      });

      Object.keys(policiesByTable).sort().forEach(tableName => {
        console.log(`\n  ${tableName}:`);
        policiesByTable[tableName].forEach(p => {
          console.log(`    - ${p.policyname}`);
          console.log(`      Command: ${p.cmd}`);
          console.log(`      Roles: ${p.roles || 'PUBLIC'}`);
          console.log(`      Permissive: ${p.permissive ? 'YES' : 'NO'}`);
        });
      });
    }
    console.log('');

    // 6. RLS Functions Analysis
    console.log('⚙️ RLS FUNCTIONS:');
    const functions = await sql(`
      SELECT
        routine_name,
        routine_type,
        data_type,
        security_type
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name LIKE '%rls%'
      OR routine_name LIKE '%tenant%'
      OR routine_name LIKE '%context%'
      OR routine_name LIKE '%user_%'
      ORDER BY routine_name
    `);

    if (functions.length > 0) {
      functions.forEach(f => {
        console.log(`  - ${f.routine_name}(${f.data_type}) [${f.security_type}]`);
      });
    } else {
      console.log('  No RLS-specific functions found');
    }
    console.log('');

    // 7. Multi-tenant table analysis
    console.log('🏢 MULTI-TENANT TABLES (with company_id):');
    const multiTenantTables = [];

    for (const table of tables) {
      const columns = await sql(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = 'company_id'
      `, [table.table_name]);

      if (columns.length > 0) {
        multiTenantTables.push({
          table: table.table_name,
          has_rls: rlsStatus.find(r => r.tablename === table.table_name)?.rls_enabled || false
        });
      }
    }

    if (multiTenantTables.length > 0) {
      console.log(`  Found ${multiTenantTables.length} multi-tenant tables:`);
      multiTenantTables.forEach(mt => {
        const rlsStatus = mt.has_rls ? '✅ RLS Enabled' : '❌ No RLS';
        console.log(`    - ${mt.table} (${rlsStatus})`);
      });
    } else {
      console.log('  No multi-tenant tables found with company_id column');
    }
    console.log('');

    // 8. Schema discrepancy detection
    console.log('⚠️  SCHEMA DISCREPANCY DETECTION:');

    // Check for expected tables based on migration files
    const expectedTables = [
      'companies',
      'users',
      'oauth_accounts',
      'quotes',
      'products',
      'company_product_definitions',
      'payment_verifications',
      'subscription_plans',
      'gcash_webhook_data',
      'gateway_device_heartbeat',
      'payment_settings'
    ];

    const missingTables = expectedTables.filter(expected =>
      !tables.find(t => t.table_name === expected)
    );

    if (missingTables.length > 0) {
      console.log('  Missing expected tables:');
      missingTables.forEach(mt => console.log(`    - ${mt}`));
    } else {
      console.log('  All expected tables present');
    }

    const extraTables = tables.filter(t =>
      !expectedTables.includes(t.table_name)
    );

    if (extraTables.length > 0) {
      console.log('  Additional tables not in expected list:');
      extraTables.forEach(et => console.log(`    - ${et.table_name}`));
    }
    console.log('');

    // 9. Test RLS foundation
    console.log('🔍 RLS FOUNDATION CHECK:');
    try {
      const rlsTest = await sql`SELECT test_rls_foundation() as result`;
      console.log('  ✅ RLS foundation functions installed and working');

      // Test individual functions
      await sql`SELECT set_tenant_context(gen_random_uuid(), 'user')`;
      const companyId = await sql`SELECT get_current_company_id() as company_id`;
      await sql`SELECT reset_tenant_context()`;
      console.log('  ✅ RLS context management functions working');

    } catch (err) {
      console.log(`  ❌ RLS foundation test failed: ${err.message}`);
    }
    console.log('');

    console.log('✅ Database structure exploration complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database exploration failed:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }
}

exploreDatabaseStructure();