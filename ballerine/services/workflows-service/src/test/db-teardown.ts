import { TestGlobal } from '@/test/test-global';

export const teardown = async () => {
  const globalThisTest = globalThis as TestGlobal;

  const stopPromises = [];

  if (globalThisTest.__DB_CONTAINER__) {
    stopPromises.push(globalThisTest.__DB_CONTAINER__.stop({ removeVolumes: true }));
  }

  if (globalThisTest.__REDIS_CONTAINER__) {
    stopPromises.push(globalThisTest.__REDIS_CONTAINER__.stop({ removeVolumes: true }));
  }

  if (stopPromises.length > 0) {
    await Promise.all(stopPromises);
  }
};

module.exports = teardown;
