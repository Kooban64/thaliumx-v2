import { QueryTypes } from 'sequelize';
import { DatabaseService } from './database';

export interface BrokerChannelReconciliationTableResult {
  table: string;
  scannedRows: number;
  updatedBrokerIdRows: number;
  updatedChannelRows: number;
  brokerChannelMissingBrokerId: number;
  directChannelWithBrokerId: number;
}

export interface BrokerChannelReconciliationResult {
  dryRun: boolean;
  results: BrokerChannelReconciliationTableResult[];
  generatedAt: string;
}

type TableSpec = {
  table: string;
  legacyBrokerColumns: string[];
};

const TABLE_SPECS: TableSpec[] = [
  {
    table: 'presale_investments',
    legacyBrokerColumns: ['attributedBrokerId', 'attributed_broker_id', 'broker_id'],
  },
  {
    table: 'internal_orders',
    legacyBrokerColumns: ['brokerId', 'broker_id'],
  },
  {
    table: 'financial_transactions',
    legacyBrokerColumns: ['brokerId', 'broker_id'],
  },
];

export class BrokerChannelReconciliationService {
  private static async hasTable(table: string): Promise<boolean> {
    const sequelize = DatabaseService.getSequelize();
    const rows = await sequelize.query<{ found: number }>(
      `
        SELECT 1::int AS found
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = :table
        LIMIT 1
      `,
      {
        type: QueryTypes.SELECT,
        replacements: { table },
      },
    );

    return rows.length > 0;
  }

  private static async hasColumn(table: string, column: string): Promise<boolean> {
    const sequelize = DatabaseService.getSequelize();
    const rows = await sequelize.query<{ found: number }>(
      `
        SELECT 1::int AS found
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = :table
          AND column_name = :column
        LIMIT 1
      `,
      {
        type: QueryTypes.SELECT,
        replacements: { table, column },
      },
    );

    return rows.length > 0;
  }

  private static async count(table: string, whereClause?: string): Promise<number> {
    const sequelize = DatabaseService.getSequelize();
    const rows = await sequelize.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM "${table}"${whereClause ? ` WHERE ${whereClause}` : ''}`,
      { type: QueryTypes.SELECT },
    );

    return Number(rows[0]?.count || '0');
  }

  private static async update(table: string, setClause: string, whereClause: string): Promise<number> {
    const sequelize = DatabaseService.getSequelize();
    const rows = await sequelize.query<{ count: number }>(
      `
        WITH updated AS (
          UPDATE "${table}"
          SET ${setClause}
          WHERE ${whereClause}
          RETURNING 1
        )
        SELECT COUNT(*)::int AS count FROM updated
      `,
      { type: QueryTypes.SELECT },
    );

    return Number(rows[0]?.count || 0);
  }

  private static async findFirstExistingLegacyBrokerColumn(spec: TableSpec): Promise<string | null> {
    for (const candidate of spec.legacyBrokerColumns) {
      if (await this.hasColumn(spec.table, candidate)) return candidate;
    }

    return null;
  }

  static async reconcile(opts?: {
    dryRun?: boolean;
    tables?: string[];
  }): Promise<BrokerChannelReconciliationResult> {
    const dryRun = opts?.dryRun !== false;
    const requestedTables = new Set((opts?.tables || []).map(t => t.trim()).filter(Boolean));

    const targets = TABLE_SPECS.filter(spec =>
      requestedTables.size === 0 ? true : requestedTables.has(spec.table),
    );

    const results: BrokerChannelReconciliationTableResult[] = [];

    for (const spec of targets) {
      if (!(await this.hasTable(spec.table))) continue;
      if (!(await this.hasColumn(spec.table, 'channel'))) continue;
      if (!(await this.hasColumn(spec.table, 'broker_id'))) continue;

      const legacyBrokerColumn = await this.findFirstExistingLegacyBrokerColumn(spec);
      const scannedRows = await this.count(spec.table);

      let updatedBrokerIdRows = 0;
      let updatedChannelRows = 0;

      if (!dryRun && legacyBrokerColumn) {
        updatedBrokerIdRows = await this.update(
          spec.table,
          '"broker_id" = CAST("' + legacyBrokerColumn + '" AS VARCHAR)',
          '"broker_id" IS NULL AND "' + legacyBrokerColumn + '" IS NOT NULL',
        );
      }

      if (!dryRun) {
        updatedChannelRows = await this.update(
          spec.table,
          `"channel" = CASE WHEN "broker_id" IS NOT NULL THEN 'broker' ELSE 'direct' END`,
          `"channel" IS NULL OR ("channel" = 'broker' AND "broker_id" IS NULL) OR ("channel" = 'direct' AND "broker_id" IS NOT NULL)`,
        );
      }

      const brokerChannelMissingBrokerId = await this.count(
        spec.table,
        `"channel" = 'broker' AND "broker_id" IS NULL`,
      );
      const directChannelWithBrokerId = await this.count(
        spec.table,
        `"channel" = 'direct' AND "broker_id" IS NOT NULL`,
      );

      results.push({
        table: spec.table,
        scannedRows,
        updatedBrokerIdRows,
        updatedChannelRows,
        brokerChannelMissingBrokerId,
        directChannelWithBrokerId,
      });
    }

    return {
      dryRun,
      results,
      generatedAt: new Date().toISOString(),
    };
  }
}

