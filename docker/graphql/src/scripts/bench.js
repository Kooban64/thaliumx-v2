/*
  Lightweight benchmark for GraphQL query latency.

  Usage:
    node src/scripts/bench.js

  Env:
    GQL_URL=http://localhost:4000/graphql
    GQL_CONCURRENCY=10
    GQL_ITERATIONS=200
*/

const { performance } = require('perf_hooks');

const GQL_URL = process.env.GQL_URL || 'http://localhost:4000/graphql';
const CONCURRENCY = Number(process.env.GQL_CONCURRENCY || 10);
const ITERATIONS = Number(process.env.GQL_ITERATIONS || 200);

function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

async function runOne(i) {
  // Default query is backend-independent (measures GraphQL layer overhead).
  // Set BENCH_MODE=market to hit marketData resolvers.
  const mode = process.env.BENCH_MODE || 'hello';

  const query = mode === 'market'
    ? {
      query: `query Market($symbol: String!) { marketData(symbol: $symbol) { symbol price lastUpdated } }`,
      variables: { symbol: i % 2 === 0 ? 'BTCUSD' : 'ETHUSD' },
    }
    : {
      query: `query { hello }`,
      variables: {},
    };

  const t0 = performance.now();
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(query),
  });
  await res.text();
  const t1 = performance.now();
  return t1 - t0;
}

async function main() {
  const latencies = [];
  let idx = 0;

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const i = idx++;
      if (i >= ITERATIONS) break;
      latencies.push(await runOne(i));
    }
  });

  await Promise.all(workers);
  const sorted = latencies.slice().sort((a, b) => a - b);

  const p50 = percentile(sorted, 0.5);
  const p95 = percentile(sorted, 0.95);
  const p99 = percentile(sorted, 0.99);
  const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    url: GQL_URL,
    iterations: ITERATIONS,
    concurrency: CONCURRENCY,
    avg_ms: Number(avg.toFixed(2)),
    p50_ms: Number(p50.toFixed(2)),
    p95_ms: Number(p95.toFixed(2)),
    p99_ms: Number(p99.toFixed(2)),
  }, null, 2));
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
