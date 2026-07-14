import { neon } from '@neondatabase/serverless';

interface DatabaseConnection {
  url: string;
  name: string;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  ordinal_position: number;
}

interface TableInfo {
  table_name: string;
  table_type: string;
}

interface IndexInfo {
  indexname: string;
  indexdef: string;
  tablename: string;
}

interface ForeignKeyInfo {
  constraint_name: string;
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

interface ConstraintInfo {
  constraint_name: string;
  constraint_type: string;
  table_name: string;
  column_name: string | null;
}

interface DatabaseSchema {
  tables: TableInfo[];
  columns: Map<string, ColumnInfo[]>;
  indexes: Map<string, IndexInfo[]>;
  foreignKeys: ForeignKeyInfo[];
  constraints: ConstraintInfo[];
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

async function getSchema(url: string): Promise<DatabaseSchema> {
  const sql = neon(url);

  const schema: DatabaseSchema = {
    tables: [],
    columns: new Map(),
    indexes: new Map(),
    foreignKeys: [],
    constraints: []
  };

  try {
    console.log(`\n🔍 Connecting to database...`);

    // Get all tables
    const tables = await sql`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY table_name
    `;
    schema.tables = tables as TableInfo[];

    // Get columns for all tables
    for (const table of schema.tables) {
      const columns = await sql`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          ordinal_position
        FROM information_schema.columns
        WHERE table_name = ${table.table_name}
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `;
      schema.columns.set(table.table_name, columns as ColumnInfo[]);
    }

    // Get indexes
    for (const table of schema.tables) {
      const indexes = await sql`
        SELECT
          indexname,
          indexdef,
          schemaname || '.' || tablename as tablename
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = ${table.table_name}
        ORDER BY indexname
      `;
      if (indexes.length > 0) {
        schema.indexes.set(table.table_name, indexes as IndexInfo[]);
      }
    }

    // Get foreign keys
    const foreignKeys = await sql`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name
    `;
    schema.foreignKeys = foreignKeys as ForeignKeyInfo[];

    // Get all constraints
    const constraints = await sql`
      SELECT
        tc.constraint_name,
        tc.constraint_type,
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints AS tc
      LEFT JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_type
    `;
    schema.constraints = constraints as ConstraintInfo[];

  } catch (error) {
    console.error('Error getting schema:', error);
    throw error;
  }

  return schema;
}

function compareSchemas(schema1: DatabaseSchema, schema2: DatabaseSchema) {
  console.log('\n' + '=' .repeat(80));
  console.log('🔄 SCHEMA COMPARISON REPORT');
  console.log('='.repeat(80));

  // Compare tables
  const tables1 = new Set(schema1.tables.map(t => t.table_name));
  const tables2 = new Set(schema2.tables.map(t => t.table_name));

  const onlyIn1 = [...tables1].filter(t => !tables2.has(t));
  const onlyIn2 = [...tables2].filter(t => !tables1.has(t));
  const commonTables = [...tables1].filter(t => tables2.has(t));

  console.log('\n📊 TABLES COMPARISON');
  console.log('-'.repeat(80));

  if (onlyIn1.length > 0) {
    console.log(`\n✅ Tables ONLY in Database 1 (${onlyIn1.length}):`);
    onlyIn1.forEach(table => console.log(`   - ${table}`));
  }

  if (onlyIn2.length > 0) {
    console.log(`\n✅ Tables ONLY in Database 2 (${onlyIn2.length}):`);
    onlyIn2.forEach(table => console.log(`   - ${table}`));
  }

  if (commonTables.length > 0) {
    console.log(`\n🔄 Common tables (${commonTables.length}):`);
    commonTables.forEach(table => console.log(`   - ${table}`));
  }

  // Compare columns for common tables
  console.log('\n📋 COLUMNS COMPARISON FOR COMMON TABLES');
  console.log('-'.repeat(80));

  for (const tableName of commonTables) {
    const columns1 = schema1.columns.get(tableName) || [];
    const columns2 = schema2.columns.get(tableName) || [];

    const cols1Map = new Map(columns1.map(c => [c.column_name, c]));
    const cols2Map = new Map(columns2.map(c => [c.column_name, c]));

    const onlyIn1 = columns1.filter(c => !cols2Map.has(c.column_name));
    const onlyIn2 = columns2.filter(c => !cols1Map.has(c.column_name));
    const commonCols = columns1.filter(c => cols2Map.has(c.column_name));

    const differences: string[] = [];

    commonCols.forEach(col1 => {
      const col2 = cols2Map.get(col1.column_name)!;

      if (col1.data_type !== col2.data_type) {
        differences.push(`   DATA TYPE: ${col1.column_name} - DB1: ${col1.data_type} vs DB2: ${col2.data_type}`);
      }
      if (col1.is_nullable !== col2.is_nullable) {
        differences.push(`   NULLABILITY: ${col1.column_name} - DB1: ${col1.is_nullable} vs DB2: ${col2.is_nullable}`);
      }
      if (col1.column_default !== col2.column_default) {
        differences.push(`   DEFAULT: ${col1.column_name} - DB1: ${col1.column_default} vs DB2: ${col2.column_default}`);
      }
    });

    if (onlyIn1.length > 0 || onlyIn2.length > 0 || differences.length > 0) {
      console.log(`\n📌 Table: ${tableName}`);

      if (onlyIn1.length > 0) {
        console.log(`   Columns ONLY in Database 1:`);
        onlyIn1.forEach(col => {
          console.log(`     - ${col.column_name} (${col.data_type})`);
        });
      }

      if (onlyIn2.length > 0) {
        console.log(`   Columns ONLY in Database 2:`);
        onlyIn2.forEach(col => {
          console.log(`     - ${col.column_name} (${col.data_type})`);
        });
      }

      if (differences.length > 0) {
        console.log(`   Column differences:`);
        differences.forEach(diff => console.log(diff));
      }
    }
  }

  // Compare indexes
  console.log('\n📑 INDEXES COMPARISON');
  console.log('-'.repeat(80));

  const allIndexedTables = new Set([
    ...schema1.indexes.keys(),
    ...schema2.indexes.keys()
  ]);

  for (const tableName of allIndexedTables) {
    const indexes1 = schema1.indexes.get(tableName) || [];
    const indexes2 = schema2.indexes.get(tableName) || [];

    const indexes1Map = new Map(indexes1.map(i => [i.indexname, i]));
    const indexes2Map = new Map(indexes2.map(i => [i.indexname, i]));

    const onlyIn1 = indexes1.filter(i => !indexes2Map.has(i.indexname));
    const onlyIn2 = indexes2.filter(i => !indexes1Map.has(i.indexname));
    const commonIndexes = indexes1.filter(i => indexes2Map.has(i.indexname));

    if (onlyIn1.length > 0 || onlyIn2.length > 0) {
      console.log(`\n📌 Table: ${tableName}`);

      if (onlyIn1.length > 0) {
        console.log(`   Indexes ONLY in Database 1:`);
        onlyIn1.forEach(idx => {
          console.log(`     - ${idx.indexname}`);
          console.log(`       ${idx.indexdef}`);
        });
      }

      if (onlyIn2.length > 0) {
        console.log(`   Indexes ONLY in Database 2:`);
        onlyIn2.forEach(idx => {
          console.log(`     - ${idx.indexname}`);
          console.log(`       ${idx.indexdef}`);
        });
      }
    }
  }

  // Compare foreign keys
  console.log('\n🔗 FOREIGN KEYS COMPARISON');
  console.log('-'.repeat(80));

  const fk1Map = new Map(schema1.foreignKeys.map(fk => [fk.constraint_name, fk]));
  const fk2Map = new Map(schema2.foreignKeys.map(fk => [fk.constraint_name, fk]));

  const fkOnlyIn1 = schema1.foreignKeys.filter(fk => !fk2Map.has(fk.constraint_name));
  const fkOnlyIn2 = schema2.foreignKeys.filter(fk => !fk1Map.has(fk.constraint_name));

  if (fkOnlyIn1.length > 0) {
    console.log(`\n   Foreign Keys ONLY in Database 1:`);
    fkOnlyIn1.forEach(fk => {
      console.log(`     - ${fk.constraint_name}`);
      console.log(`       ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });
  }

  if (fkOnlyIn2.length > 0) {
    console.log(`\n   Foreign Keys ONLY in Database 2:`);
    fkOnlyIn2.forEach(fk => {
      console.log(`     - ${fk.constraint_name}`);
      console.log(`       ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
    });
  }

  // Compare constraints
  console.log('\n📐 CONSTRAINTS COMPARISON');
  console.log('-'.repeat(80));

  const cons1Map = new Map(schema1.constraints.map(c => [c.constraint_name, c]));
  const cons2Map = new Map(schema2.constraints.map(c => [c.constraint_name, c]));

  const consOnlyIn1 = schema1.constraints.filter(c => !cons2Map.has(c.constraint_name));
  const consOnlyIn2 = schema2.constraints.filter(c => !cons1Map.has(c.constraint_name));

  if (consOnlyIn1.length > 0) {
    console.log(`\n   Constraints ONLY in Database 1:`);
    consOnlyIn1.forEach(cons => {
      console.log(`     - ${cons.constraint_name} (${cons.constraint_type}) on ${cons.table_name}`);
    });
  }

  if (consOnlyIn2.length > 0) {
    console.log(`\n   Constraints ONLY in Database 2:`);
    consOnlyIn2.forEach(cons => {
      console.log(`     - ${cons.constraint_name} (${cons.constraint_type}) on ${cons.table_name}`);
    });
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📈 SUMMARY');
  console.log('='.repeat(80));

  console.log(`\nDatabase 1 (holy-leaf):`);
  console.log(`  - Tables: ${schema1.tables.length}`);
  console.log(`  - Total columns: ${[...schema1.columns.values()].flat().length}`);
  console.log(`  - Total indexes: ${[...schema1.indexes.values()].flat().length}`);
  console.log(`  - Foreign keys: ${schema1.foreignKeys.length}`);
  console.log(`  - Constraints: ${schema1.constraints.length}`);

  console.log(`\nDatabase 2 (steep-unit):`);
  console.log(`  - Tables: ${schema2.tables.length}`);
  console.log(`  - Total columns: ${[...schema2.columns.values()].flat().length}`);
  console.log(`  - Total indexes: ${[...schema2.indexes.values()].flat().length}`);
  console.log(`  - Foreign keys: ${schema2.foreignKeys.length}`);
  console.log(`  - Constraints: ${schema2.constraints.length}`);

  console.log(`\nKey Differences:`);
  console.log(`  - Tables exclusive to DB1: ${onlyIn1.length}`);
  console.log(`  - Tables exclusive to DB2: ${onlyIn2.length}`);
  console.log(`  - Common tables: ${commonTables.length}`);

  console.log('\n' + '='.repeat(80));
}

async function main() {
  console.log('🚀 Starting Schema Comparison...');

  try {
    const schema1 = await getSchema(databases[0].url);
    console.log(`✅ Successfully connected to ${databases[0].name}`);

    const schema2 = await getSchema(databases[1].url);
    console.log(`✅ Successfully connected to ${databases[1].name}`);

    compareSchemas(schema1, schema2);

    console.log('\n✨ Schema comparison completed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Schema comparison failed:', error);
    process.exit(1);
  }
}

main();