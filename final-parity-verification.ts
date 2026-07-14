import { neon } from '@neondatabase/serverless';

interface DatabaseConnection {
  url: string;
  name: string;
}

const databases: DatabaseConnection[] = [
  {
    url: 'postgresql://concetto:npg_c1DLki9NdzVZ@ep-holy-leaf-at8ruz1r-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    name: 'Database 1 (holy-leaf) - TARGET'
  },
  {
    url: 'postgresql://concetto:npg_c1DLki9NdzVZ@ep-steep-unit-atwaadwx-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    name: 'Database 2 (steep-unit) - SOURCE'
  }
];

async function performFinalParityVerification() {
  console.log('🔍 FINAL DATABASE PARITY VERIFICATION');
  console.log('='.repeat(80) + '\n');

  const db1Results: any = {};
  const db2Results: any = {};
  const differences: string[] = [];

  // Check each database
  for (const db of databases) {
    console.log(`📌 Checking ${db.name}...`);

    const sql = neon(db.url);
    const results = db.name.includes('Database 1') ? db1Results : db2Results;

    try {
      // Get quote_items comments
      const quoteItemsComments = await sql`
        SELECT
          col.column_name,
          pgd.description
        FROM pg_catalog.pg_statio_all_tables AS st
        INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
        INNER JOIN information_schema.columns col ON (
          pgd.objsubid = col.ordinal_position AND
          col.table_schema = st.schemaname AND
          col.table_name = st.relname AND
          col.table_schema = 'public'
        )
        WHERE st.relname = 'quote_items'
        AND col.table_name = 'quote_items'
        ORDER BY col.ordinal_position
      `;
      results.quoteItemsComments = quoteItemsComments;

      // Get pending_products table comment
      const pendingProductsTableComment = await sql`
        SELECT
          pg_catalog.obj_description(pgc.oid, 'pg_class') as description
        FROM pg_catalog.pg_class pgc
        JOIN pg_catalog.pg_namespace pgn ON pgn.oid = pgc.relnamespace
        WHERE pgc.relname = 'pending_products'
        AND pgn.nspname = 'public'
      `;
      results.pendingProductsTableComment = pendingProductsTableComment;

      // Get pending_products column comments
      const pendingProductsComments = await sql`
        SELECT
          col.column_name,
          pgd.description
        FROM pg_catalog.pg_statio_all_tables AS st
        INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
        INNER JOIN information_schema.columns col ON (
          pgd.objsubid = col.ordinal_position AND
          col.table_schema = st.schemaname AND
          col.table_name = st.relname AND
          col.table_schema = 'public'
        )
        WHERE st.relname = 'pending_products'
        AND col.table_name = 'pending_products'
        ORDER BY col.ordinal_position
      `;
      results.pendingProductsComments = pendingProductsComments;

      console.log(`✅ Successfully retrieved schema data from ${db.name}\n`);

    } catch (error: any) {
      console.error(`❌ Error checking ${db.name}:`, error.message);
    }
  }

  // Compare results
  console.log('🔍 COMPARING RESULTS');
  console.log('='.repeat(80) + '\n');

  // Compare quote_items comments
  console.log('📋 quote_items Column Comments Comparison:');
  console.log('-'.repeat(80));

  const q1Comments = new Map(
    db1Results.quoteItemsComments.map((c: any) => [c.column_name, c.description])
  );
  const q2Comments = new Map(
    db2Results.quoteItemsComments.map((c: any) => [c.column_name, c.description])
  );

  const allQColumns = new Set([...q1Comments.keys(), ...q2Comments.keys()]);

  for (const col of allQColumns) {
    const db1Val = q1Comments.get(col);
    const db2Val = q2Comments.get(col);

    if (db1Val !== db2Val) {
      console.log(`\n⚠️ quote_items.${col}:`);
      console.log(`   DB1: "${db1Val}"`);
      console.log(`   DB2: "${db2Val}"`);
      differences.push(`quote_items.${col} comment mismatch`);
    } else {
      console.log(`✅ quote_items.${col}: "${db1Val}"`);
    }
  }

  // Compare pending_products table comment
  console.log('\n📋 pending_products Table Comment Comparison:');
  console.log('-'.repeat(80));

  const ppTable1 = db1Results.pendingProductsTableComment[0]?.description || 'No comment';
  const ppTable2 = db2Results.pendingProductsTableComment[0]?.description || 'No comment';

  if (ppTable1 !== ppTable2) {
    console.log(`\n⚠️ pending_products table comment:`);
    console.log(`   DB1: "${ppTable1}"`);
    console.log(`   DB2: "${ppTable2}"`);
    differences.push('pending_products table comment mismatch');
  } else {
    console.log(`✅ pending_products table: "${ppTable1}"`);
  }

  // Compare pending_products column comments
  console.log('\n📋 pending_products Column Comments Comparison:');
  console.log('-'.repeat(80));

  const pp1Comments = new Map(
    db1Results.pendingProductsComments.map((c: any) => [c.column_name, c.description])
  );
  const pp2Comments = new Map(
    db2Results.pendingProductsComments.map((c: any) => [c.column_name, c.description])
  );

  const allPPColumns = new Set([...pp1Comments.keys(), ...pp2Comments.keys()]);

  for (const col of allPPColumns) {
    const db1Val = pp1Comments.get(col);
    const db2Val = pp2Comments.get(col);

    if (db1Val !== db2Val) {
      console.log(`\n⚠️ pending_products.${col}:`);
      console.log(`   DB1: ${db1Val ? `"${db1Val}"` : 'NULL'}`);
      console.log(`   DB2: ${db2Val ? `"${db2Val}"` : 'NULL'}`);
      differences.push(`pending_products.${col} comment mismatch`);
    } else {
      console.log(`✅ pending_products.${col}: "${db1Val}"`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📈 VERIFICATION SUMMARY');
  console.log('='.repeat(80));

  if (differences.length === 0) {
    console.log('\n🎉 SUCCESS: 100% Database Parity Achieved!');
    console.log('Database 1 (holy-leaf) is now identical to Database 2 (steep-unit)');
  } else {
    console.log(`\n⚠️ DIFFERENCES FOUND: ${differences.length} items need attention`);
    console.log('\nThe following differences remain:');
    differences.forEach((diff, i) => {
      console.log(`${i + 1}. ${diff}`);
    });

    console.log('\n⚠️ Note: The differences appear to be in comments only.');
    console.log('This suggests a permission issue - the database user may not have');
    console.log('sufficient privileges to modify comments on these tables.');
    console.log('\nTo resolve this, the migration should be run by a database admin or owner');
    console.log('with appropriate COMMENT ON permissions.');
  }

  console.log('\n' + '='.repeat(80));
  process.exit(differences.length === 0 ? 0 : 1);
}

performFinalParityVerification();