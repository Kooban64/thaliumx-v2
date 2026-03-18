import { StartedPostgreSqlContainer } from 'testcontainers';

export type TestGlobal = typeof globalThis & {
  __DB_CONTAINER__?: StartedPostgreSqlContainer;
  __REDIS_CONTAINER__?: any;
};
