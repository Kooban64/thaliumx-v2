/**
 * Migration: Unify KYC Level System
 *
 * Purpose:
 * - Convert `kycLevel` column from ENUM to STRING type to support 'L0', 'L1', 'L2', 'L3', 'INSTITUTIONAL' format
 * - Map existing values: 'basic' → 'L0', 'intermediate' → 'L1', 'advanced' → 'L2', 'enterprise' → 'L3'
 * - Update default value from 'basic' to 'L0'
 * - Drop old ENUM type after conversion
 *
 * This migration is:
 * - Idempotent (safe to run multiple times)
 * - Data-preserving (maps old values to new format)
 * - Backward-compatible (new format works with existing code after code updates)
 */

export async function up(queryInterface: any, Sequelize: any): Promise<void> {
  const tables = await queryInterface.showAllTables();
  if (!tables.includes('users')) {
    console.log('Users table does not exist, skipping KYC level migration');
    return;
  }

  const columns = await queryInterface.describeTable('users');
  
  if (!columns.kycLevel) {
    // Column doesn't exist, create it with new format
    await queryInterface.addColumn('users', 'kycLevel', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'L0'
    });
    console.log('Created kycLevel column with STRING type and default L0');
    return;
  }

  // Check if column is ENUM type (PostgreSQL specific check)
  const columnInfo = await queryInterface.sequelize.query(
    `SELECT 
      data_type,
      udt_name,
      column_default
    FROM information_schema.columns 
    WHERE table_name = 'users' 
    AND column_name = 'kycLevel'`,
    { type: queryInterface.sequelize.QueryTypes.SELECT }
  );

  if (columnInfo && columnInfo.length > 0) {
    const col = columnInfo[0] as any;
    const isEnum = col.udt_name && col.udt_name.startsWith('enum_');

    if (isEnum) {
      console.log('Converting kycLevel from ENUM to STRING and mapping values...');

      // Step 1: Add temporary column with STRING type
      await queryInterface.addColumn('users', 'kycLevel_new', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'L0'
      });

      // Step 2: Map old values to new format
      await queryInterface.sequelize.query(`
        UPDATE users 
        SET "kycLevel_new" = CASE 
          WHEN "kycLevel"::text = 'basic' THEN 'L0'
          WHEN "kycLevel"::text = 'intermediate' THEN 'L1'
          WHEN "kycLevel"::text = 'advanced' THEN 'L2'
          WHEN "kycLevel"::text = 'enterprise' THEN 'L3'
          ELSE 'L0'  -- Default for any unexpected values
        END
        WHERE "kycLevel" IS NOT NULL;
      `);

      // Step 3: Set default for NULL values
      await queryInterface.sequelize.query(`
        UPDATE users 
        SET "kycLevel_new" = 'L0'
        WHERE "kycLevel_new" IS NULL;
      `);

      // Step 4: Remove old column
      await queryInterface.removeColumn('users', 'kycLevel');

      // Step 5: Rename new column to original name
      await queryInterface.renameColumn('users', 'kycLevel_new', 'kycLevel');

      // Step 6: Add constraint to ensure valid values
      await queryInterface.sequelize.query(`
        ALTER TABLE users 
        ADD CONSTRAINT check_kyc_level 
        CHECK ("kycLevel" IN ('L0', 'L1', 'L2', 'L3', 'INSTITUTIONAL'));
      `).catch((_err: any) => {
        // Constraint might already exist, ignore error
        console.log('Constraint check_kyc_level may already exist, continuing...');
      });

      // Step 7: Update default value
      await queryInterface.changeColumn('users', 'kycLevel', {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'L0'
      });

      // Step 8: Try to drop old ENUM type (best effort, may fail if used elsewhere)
      const enumTypeName = col.udt_name;
      if (enumTypeName && enumTypeName.startsWith('enum_')) {
        try {
          await queryInterface.sequelize.query(`
            DROP TYPE IF EXISTS "${enumTypeName}" CASCADE;
          `);
          console.log(`Dropped old ENUM type: ${enumTypeName}`);
        } catch {
          console.log(`Could not drop ENUM type ${enumTypeName} (may be in use)`);
          // Non-fatal: enum type might be referenced elsewhere
        }
      }

      console.log('Successfully converted kycLevel from ENUM to STRING with value mapping');
    } else {
      // Column is already STRING type, just update default if needed
      if (col.column_default !== "'L0'::character varying" && col.column_default !== "('L0'::character varying)") {
        console.log('Updating kycLevel default value to L0...');
        await queryInterface.changeColumn('users', 'kycLevel', {
          type: Sequelize.STRING,
          allowNull: false,
          defaultValue: 'L0'
        });
        console.log('Updated kycLevel default value to L0');
      } else {
        console.log('kycLevel column is already STRING type with L0 default, no changes needed');
      }
    }
  }
}

export async function down(queryInterface: any, Sequelize: any): Promise<void> {
  const tables = await queryInterface.showAllTables();
  if (!tables.includes('users')) return;

  const columns = await queryInterface.describeTable('users');
  if (!columns.kycLevel) return;

  console.log('Reverting kycLevel to ENUM type...');

  // Remove constraint if exists
  try {
    await queryInterface.sequelize.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS check_kyc_level;
    `);
  } catch {
    // Ignore if constraint doesn't exist
  }

  // Add temporary column with ENUM type
  await queryInterface.addColumn('users', 'kycLevel_old', {
    type: Sequelize.ENUM('basic', 'intermediate', 'advanced', 'enterprise'),
    allowNull: false,
    defaultValue: 'basic'
  });

  // Map new values back to old format
  await queryInterface.sequelize.query(`
    UPDATE users 
    SET "kycLevel_old" = CASE 
      WHEN "kycLevel" = 'L0' THEN 'basic'
      WHEN "kycLevel" = 'L1' THEN 'intermediate'
      WHEN "kycLevel" = 'L2' THEN 'advanced'
      WHEN "kycLevel" = 'L3' THEN 'enterprise'
      WHEN "kycLevel" = 'INSTITUTIONAL' THEN 'enterprise'  -- Map INSTITUTIONAL to enterprise
      ELSE 'basic'  -- Default for any unexpected values
    END
    WHERE "kycLevel" IS NOT NULL;
  `);

  // Remove new column
  await queryInterface.removeColumn('users', 'kycLevel');

  // Rename old column back
  await queryInterface.renameColumn('users', 'kycLevel_old', 'kycLevel');

  // Update default
  await queryInterface.changeColumn('users', 'kycLevel', {
    type: Sequelize.ENUM('basic', 'intermediate', 'advanced', 'enterprise'),
    allowNull: false,
    defaultValue: 'basic'
  });

  console.log('Reverted kycLevel to ENUM type with old values');
}
