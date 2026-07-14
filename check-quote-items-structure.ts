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

async function checkQuoteItemsStructure() {
  console.log('🔍 Checking quote_items table structure in both databases...\n');

  for (const db of databases) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📌 ${db.name}`);
    console.log('='.repeat(80));

    const sql = neon(db.url);

    try {
      // Get quote_items table columns
      const columns = await sql`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          ordinal_position
        FROM information_schema.columns
        WHERE table_name = 'quote_items'
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `;

      console.log('\n📋 Columns:');
      console.log(columns.map(col =>
        `${col.ordinal_position}. ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`
      ).join('\n'));

      // Get indexes
      const indexes = await sql`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'quote_items'
        ORDER BY indexname
      `;

      console.log('\n📑 Indexes:');
      if (indexes.length > 0) {
        indexes.forEach(idx => {
          console.log(`- ${idx.indexname}`);
          console.log(`  ${idx.indexdef}`);
        });
      } else {
        console.log('No indexes found');
      }

      // Get constraints
      const constraints = await sql`
        SELECT
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name
        FROM information_schema.table_constraints AS tc
        LEFT JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = 'quote_items'
        AND tc.table_schema = 'public'
        ORDER BY tc.constraint_type, tc.constraint_name
      `;

      console.log('\n📐 Constraints:');
      if (constraints.length > 0) {
        constraints.forEach(cons => {
          console.log(`- ${cons.constraint_name} (${cons.constraint_type}) ${cons.column_name ? `on ${cons.column_name}` : ''}`);
        });
      } else {
        console.log('No constraints found');
      }

      // Get column comments
      const comments = await sql`
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

      console.log('\n💬 Column Comments:');
      if (comments.length > 0) {
        comments.forEach(comment => {
          console.log(`- ${comment.column_name}: ${comment.description}`);
        });
      } else {
        console.log('No comments found');
      }

      // Get table comment
      const tableComment = await sql`
        SELECT
          pg_catalog.obj_description(pgc.oid, 'pg_class') as description
        FROM pg_catalog.pg_class pgc
        JOIN pg_catalog.pg_namespace pgn ON pgn.oid = pgc.relnamespace
        WHERE pgc.relname = 'quote_items'
        AND pgn.nspname = 'public'
      `;

      console.log('\n📝 Table Comment:');
      if (tableComment.length > 0 && tableComment[0].description) {
        console.log(tableComment[0].description);
      } else {
        console.log('No table comment found');
      }

    } catch (error) {
      console.error(`❌ Error checking ${db.name}:`, error);
    }
  }

  console.log(`\n${'='.repeat(80)}\n`);
  process.exit(0);
}

checkQuoteItemsStructure();