import { neon } from '@neondatabase/serverless';

interface DatabaseConnection {
  url: string;
  name: string;
}

const databases: DatabaseConnection[] = [
  {
    url: 'postgresql://concetto:npg_c1DLki9NdzVZ@ep-holy-leaf-at8ruz1r-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    name: 'Database 1 (holy-leaf)'
  },
  {
    url: 'postgresql://concetto:npg_c1DLki9NdzVZ@ep-steep-unit-atwaadwx-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    name: 'Database 2 (steep-unit)'
  }
];

async function checkCommentsDifference() {
  console.log('🔍 Checking comments for quote_items and pending_products tables...\n');

  for (const db of databases) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📌 ${db.name}`);
    console.log('='.repeat(80));

    const sql = neon(db.url);

    try {
      // Check quote_items table comment
      const quoteItemsTableComment = await sql`
        SELECT
          pg_catalog.obj_description(pgc.oid, 'pg_class') as description
        FROM pg_catalog.pg_class pgc
        JOIN pg_catalog.pg_namespace pgn ON pgn.oid = pgc.relnamespace
        WHERE pgc.relname = 'quote_items'
        AND pgn.nspname = 'public'
      `;

      console.log('\n📝 quote_items Table Comment:');
      if (quoteItemsTableComment.length > 0 && quoteItemsTableComment[0].description) {
        console.log(quoteItemsTableComment[0].description);
      } else {
        console.log('No table comment found');
      }

      // Check quote_items column comments
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

      console.log('\n💬 quote_items Column Comments:');
      if (quoteItemsComments.length > 0) {
        quoteItemsComments.forEach(comment => {
          console.log(`- ${comment.column_name}: ${comment.description}`);
        });
      } else {
        console.log('No column comments found');
      }

      // Check pending_products table comment
      const pendingProductsTableComment = await sql`
        SELECT
          pg_catalog.obj_description(pgc.oid, 'pg_class') as description
        FROM pg_catalog.pg_class pgc
        JOIN pg_catalog.pg_namespace pgn ON pgn.oid = pgc.relnamespace
        WHERE pgc.relname = 'pending_products'
        AND pgn.nspname = 'public'
      `;

      console.log('\n📝 pending_products Table Comment:');
      if (pendingProductsTableComment.length > 0 && pendingProductsTableComment[0].description) {
        console.log(pendingProductsTableComment[0].description);
      } else {
        console.log('No table comment found');
      }

      // Check pending_products column comments
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

      console.log('\n💬 pending_products Column Comments:');
      if (pendingProductsComments.length > 0) {
        pendingProductsComments.forEach(comment => {
          console.log(`- ${comment.column_name}: ${comment.description}`);
        });
      } else {
        console.log('No column comments found');
      }

      // Check pending_products constraint definition
      const pendingProductsConstraints = await sql`
        SELECT
          tc.constraint_name,
          tc.constraint_type,
          cc.check_clause
        FROM information_schema.table_constraints AS tc
        LEFT JOIN information_schema.check_constraints cc
          ON tc.constraint_name = cc.constraint_name
          AND tc.constraint_schema = cc.constraint_schema
        WHERE tc.table_name = 'pending_products'
        AND tc.constraint_schema = 'public'
        AND tc.constraint_type = 'CHECK'
        ORDER BY tc.constraint_name
      `;

      console.log('\n📐 pending_products Check Constraints:');
      if (pendingProductsConstraints.length > 0) {
        pendingProductsConstraints.forEach(cons => {
          console.log(`- ${cons.constraint_name}:`);
          console.log(`  ${cons.check_clause}`);
        });
      } else {
        console.log('No check constraints found');
      }

    } catch (error) {
      console.error(`❌ Error checking ${db.name}:`, error);
    }
  }

  console.log(`\n${'='.repeat(80)}\n`);
  process.exit(0);
}

checkCommentsDifference();