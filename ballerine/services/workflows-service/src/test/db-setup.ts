import { PostgreSqlContainer, GenericContainer } from 'testcontainers';

import console from 'console';
import { TestGlobal } from '@/test/test-global';
import { execSync } from 'child_process';

process.env.LOG_LEVEL = 'error';

// Set minimal required environment variables for tests
process.env.ENVIRONMENT_NAME = 'test';
process.env.BCRYPT_SALT = '10';
process.env.PORT = '3000';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.BACKOFFICE_CORS_ORIGIN = 'http://localhost:3000';
process.env.WORKFLOW_DASHBOARD_CORS_ORIGIN = 'http://localhost:3000';
process.env.KYB_EXAMPLE_CORS_ORIGIN = 'http://localhost:3000';
process.env.KYC_EXAMPLE_CORS_ORIGIN = 'http://localhost:3000';
process.env.API_KEY = 'test-api-key';
process.env.UNIFIED_API_URL = 'http://localhost:3001';
process.env.APP_API_URL = 'http://localhost:3000';
process.env.NOTION_API_KEY = 'test-notion-key';
process.env.MAGIC_LINK_AUTH_JWT_SECRET = 'test-jwt-secret';
process.env.QUEUE_SYSTEM_ENABLED = 'false';

const DATABASE_NAME = 'test';

module.exports = async () => {
  // Check if this is an integration test that needs database setup
  const isIntegrationTest = process.argv.some(
    arg => arg.includes('intg.test') || arg.includes('e2e.test'),
  );

  if (process.env.SKIP_DB_SETUP_TEARDOWN || !isIntegrationTest) {
    // Set dummy environment variables for unit tests
    process.env.DB_URL = 'postgresql://dummy:dummy@localhost:5432/dummy';
    process.env.REDIS_HOST = 'localhost';
    process.env.REDIS_PORT = '6379';
    process.env.REDIS_PASSWORD = 'dummy';
    return;
  }

  const containers = await Promise.all([
    // Start PostgreSQL container
    new PostgreSqlContainer('sibedge/postgres-plv8:15.3-3.1.7')
      .withDatabase(DATABASE_NAME)
      .withExposedPorts({ host: 5444, container: 5432 })
      .withHealthCheck({
        test: ['CMD', 'pg_isready -d test_postgress -U test_user -p 5432'],
        interval: 10000, // 10 seconds
        startPeriod: 5000, // 5 seconds
        retries: 5,
      })
      .start(),

    // Start Redis container
    new GenericContainer('redis:alpine')
      .withExposedPorts(6379)
      .withCommand(['redis-server', '--requirepass', 'test-redis-password'])
      .withHealthCheck({
        test: ['CMD', 'redis-cli', '--raw', 'incr', 'ping'],
        interval: 5000,
        startPeriod: 2000,
        retries: 5,
      })
      .start(),
  ]);

  const [dbContainer, redisContainer] = containers;

  process.env.DB_URL = dbContainer.getConnectionUri();
  process.env.REDIS_HOST = redisContainer.getHost();
  process.env.REDIS_PORT = redisContainer.getMappedPort(6379).toString();
  process.env.REDIS_PASSWORD = 'test-redis-password';

  console.log('\nStarting database container on: ' + process.env.DB_URL);
  console.log(
    'Starting Redis container on: ' + process.env.REDIS_HOST + ':' + process.env.REDIS_PORT,
  );

  runPrismaMigrations();

  (globalThis as TestGlobal).__DB_CONTAINER__ = dbContainer;
  (globalThis as TestGlobal).__REDIS_CONTAINER__ = redisContainer;
};

const runPrismaMigrations = () => {
  if (process.env.SKIP_DB_SETUP_TEARDOWN) {
    return;
  }

  try {
    execSync('npx prisma migrate dev --preview-feature', { stdio: 'inherit' });
  } catch (error) {
    console.error('Prisma migration failed:');
    console.error(error);
  }
};
