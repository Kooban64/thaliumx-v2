import type { QueryInterface } from 'sequelize';

type CompatTableSpec = {
  table: string;
  legacyBrokerColumns: string[];
};

const TABLES: CompatTableSpec[] = [
  {
    table: 'presale_investments',
    legacyBrokerColumns: ['broker_id', 'attributedBrokerId', 'attributed_broker_id'],
  },
  {
    table: 'internal_orders',
    legacyBrokerColumns: ['broker_id', 'brokerId'],
  },
  {
    table: 'financial_transactions',
    legacyBrokerColumns: ['broker_id', 'brokerId'],
  },
];

const hasColumn = async (
  queryInterface: QueryInterface,
  table: string,
  column: string,
): Promise<boolean> => {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1
    `,
    { bind: [table, column] },
  );

  return Array.isArray(rows) && rows.length > 0;
};

const hasTable = async (queryInterface: QueryInterface, table: string): Promise<boolean> => {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = $1
      LIMIT 1
    `,
    { bind: [table] },
  );

  return Array.isArray(rows) && rows.length > 0;
};

const pickExistingLegacyBrokerColumn = async (
  queryInterface: QueryInterface,
  table: string,
  candidates: string[],
): Promise<string | null> => {
  for (const candidate of candidates) {
    if (await hasColumn(queryInterface, table, candidate)) {
      return candidate;
    }
  }
  return null;
};

export async function up(queryInterface: QueryInterface): Promise<void> {
  for (const spec of TABLES) {
    if (!(await hasTable(queryInterface, spec.table))) continue;

    if (!(await hasColumn(queryInterface, spec.table, 'channel'))) {
      await queryInterface.sequelize.query(`ALTER TABLE "${spec.table}" ADD COLUMN "channel" VARCHAR(16)`);
      await queryInterface.sequelize.query(
        `COMMENT ON COLUMN "${spec.table}"."channel" IS 'Canonical session channel: direct|broker (compat overlay)'`,
      );
    }

    if (!(await hasColumn(queryInterface, spec.table, 'broker_id'))) {
      await queryInterface.sequelize.query(`ALTER TABLE "${spec.table}" ADD COLUMN "broker_id" VARCHAR(255)`);
      await queryInterface.sequelize.query(
        `COMMENT ON COLUMN "${spec.table}"."broker_id" IS 'Canonical broker identifier (compat overlay)'`,
      );
    }

    try {
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS "idx_${spec.table}_channel" ON "${spec.table}" ("channel")`,
      );
    } catch {
      // no-op
    }

    try {
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS "idx_${spec.table}_broker_id" ON "${spec.table}" ("broker_id")`,
      );
    } catch {
      // no-op
    }

    const legacyBrokerColumn = await pickExistingLegacyBrokerColumn(
      queryInterface,
      spec.table,
      spec.legacyBrokerColumns,
    );

    if (legacyBrokerColumn) {
      await queryInterface.sequelize.query(
        `
          UPDATE "${spec.table}"
          SET "broker_id" = COALESCE("broker_id", CAST("${legacyBrokerColumn}" AS VARCHAR))
          WHERE "broker_id" IS NULL
            AND "${legacyBrokerColumn}" IS NOT NULL
        `,
      );
    }

    await queryInterface.sequelize.query(
      `
        UPDATE "${spec.table}"
        SET "channel" = CASE
          WHEN "broker_id" IS NOT NULL THEN 'broker'
          ELSE 'direct'
        END
        WHERE "channel" IS NULL
      `,
    );
  }
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  for (const spec of TABLES) {
    if (!(await hasTable(queryInterface, spec.table))) continue;

    try {
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "idx_${spec.table}_broker_id"`);
    } catch {
      // no-op
    }
    try {
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS "idx_${spec.table}_channel"`);
    } catch {
      // no-op
    }

    if (await hasColumn(queryInterface, spec.table, 'broker_id')) {
      await queryInterface.sequelize.query(`ALTER TABLE "${spec.table}" DROP COLUMN "broker_id"`);
    }

    if (await hasColumn(queryInterface, spec.table, 'channel')) {
      await queryInterface.sequelize.query(`ALTER TABLE "${spec.table}" DROP COLUMN "channel"`);
    }
  }
}

