#!/usr/bin/env ts-node

/**
 * Seed All Roles Script
 * Creates users for all roles with password "foobarfoobar" and simple IDs
 */

import { DatabaseService } from '../src/services/database';
import { LoggerService } from '../src/services/logger';
import { AuthService } from '../src/services/auth';

const PASSWORD = 'foobarfoobar';

const users = [
  // Admin roles
  {
    email: 'admin@thaliumx.com',
    password: PASSWORD,
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin',
    kycLevel: 'L3',
    kycStatus: 'approved',
    tenantId: '10000000-0000-0000-0000-000000000000', // ThaliumX Platform
  },
  {
    email: 'superadmin@thaliumx.com',
    password: PASSWORD,
    firstName: 'Super',
    lastName: 'Admin',
    role: 'super_admin',
    kycLevel: 'L3',
    kycStatus: 'approved',
    tenantId: '10000000-0000-0000-0000-000000000000',
  },
  {
    email: 'platformadmin@thaliumx.com',
    password: PASSWORD,
    firstName: 'Platform',
    lastName: 'Admin',
    role: 'platform-admin',
    kycLevel: 'L3',
    kycStatus: 'approved',
    tenantId: '10000000-0000-0000-0000-000000000000',
  },
  // Broker roles
  {
    email: 'broker@thaliumx.com',
    password: PASSWORD,
    firstName: 'Broker',
    lastName: 'Admin',
    role: 'broker_admin',
    kycLevel: 'L3',
    kycStatus: 'approved',
    tenantId: '00000000-0000-0000-0000-000000000003', // Demo Broker
  },
  {
    email: 'broker1@thaliumx.com',
    password: PASSWORD,
    firstName: 'Broker',
    lastName: 'One',
    role: 'broker_1',
    kycLevel: 'L2',
    kycStatus: 'approved',
    tenantId: '00000000-0000-0000-0000-000000000003',
  },
  {
    email: 'broker2@thaliumx.com',
    password: PASSWORD,
    firstName: 'Broker',
    lastName: 'Two',
    role: 'broker_2',
    kycLevel: 'L2',
    kycStatus: 'approved',
    tenantId: '00000000-0000-0000-0000-000000000003',
  },
  // Regular users
  {
    email: 'user@thaliumx.com',
    password: PASSWORD,
    firstName: 'Regular',
    lastName: 'User',
    role: 'user',
    kycLevel: 'L1',
    kycStatus: 'approved',
    tenantId: '10000000-0000-0000-0000-000000000000',
  },
  {
    email: 'user1@thaliumx.com',
    password: PASSWORD,
    firstName: 'User',
    lastName: 'One',
    role: 'user',
    kycLevel: 'L1',
    kycStatus: 'approved',
    tenantId: '10000000-0000-0000-0000-000000000000',
  },
  {
    email: 'user2@thaliumx.com',
    password: PASSWORD,
    firstName: 'User',
    lastName: 'Two',
    role: 'user',
    kycLevel: 'L2',
    kycStatus: 'approved',
    tenantId: '10000000-0000-0000-0000-000000000000',
  },
  {
    email: 'user3@thaliumx.com',
    password: PASSWORD,
    firstName: 'User',
    lastName: 'Three',
    role: 'user',
    kycLevel: 'L3',
    kycStatus: 'approved',
    tenantId: '10000000-0000-0000-0000-000000000000',
  },
  // Trader role
  {
    email: 'trader@thaliumx.com',
    password: PASSWORD,
    firstName: 'Test',
    lastName: 'Trader',
    role: 'trader',
    kycLevel: 'L2',
    kycStatus: 'approved',
    tenantId: '10000000-0000-0000-0000-000000000000',
  },
];

async function seedAllRoles(): Promise<void> {
  LoggerService.info('🌱 Starting seed for all roles...');

  try {
    // Initialize database connection
    await DatabaseService.initialize();
    LoggerService.info('✅ Database connection established');

    let successCount = 0;
    let errorCount = 0;

    for (const userData of users) {
      try {
        // Check if user already exists
        const existingUser = await DatabaseService.getModel('User').findOne({
          where: { email: userData.email }
        });

        if (existingUser) {
          LoggerService.warn(`User ${userData.email} already exists, skipping...`);
          continue;
        }

        // Register user using AuthService (handles password hashing, Zitadel, etc.)
        await AuthService.register({
          email: userData.email,
          password: userData.password,
          firstName: userData.firstName,
          lastName: userData.lastName,
          tenantId: userData.tenantId,
        });

        // Update role and KYC status after creation
        const UserModel = DatabaseService.getModel('User');
        await UserModel.update(
          {
            role: userData.role,
            kycLevel: userData.kycLevel,
            kycStatus: userData.kycStatus,
            isActive: true,
            isVerified: true,
          },
          {
            where: { email: userData.email }
          }
        );

        LoggerService.info(`✅ Created user: ${userData.email} (${userData.role})`);
        successCount++;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        LoggerService.error(`❌ Failed to create user ${userData.email}:`, errorMessage);
        errorCount++;
      }
    }

    LoggerService.info(`\n✅ Seeding complete!`);
    LoggerService.info(`   Success: ${successCount}`);
    LoggerService.info(`   Errors: ${errorCount}`);
    LoggerService.info(`\n📋 All users have password: ${PASSWORD}`);

  } catch (error) {
    LoggerService.error('❌ Seeding failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedAllRoles()
    .then(() => {
      LoggerService.info('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      LoggerService.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { seedAllRoles };
