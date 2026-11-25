// k6 conversion of Highlevel.jmx
//
// Run:   k6 run highlevel_k6.js
// Options (environment variables):
//   BASE_URL       default http://host.docker.internal:8080
//   VUS            default 150   (JMeter: 150 threads)
//   RAMP           default 90s   (JMeter: ramp-up 90 s)
//   STEADY         default 0s    (JMeter: duration 90 s = ramp only; set e.g. 10m for a steady-state test)
//   EXCLUSIVE_MIX  default false (see "Transaction mix" below)
//
// SLAs (thresholds): P95 response time < 800 ms and error rate < 1%,
// overall and per transaction. k6 exits with a non-zero code if any SLA is breached,
// so the same script works as a CI/CD quality gate.

import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://host.docker.internal:8080';
const VUS = parseInt(__ENV.VUS || '150', 10);
const RAMP = __ENV.RAMP || '90s';
const STEADY = __ENV.STEADY || '0s';
const EXCLUSIVE_MIX = (__ENV.EXCLUSIVE_MIX || 'false') === 'true';

const SLA_MS = 800;           // response time SLA
const MAX_ERROR_RATE = 0.01;  // error rate SLA (1%)
const TOKEN_REFRESH_MS = 80 * 1000; // JMeter If Controller: re-login after 80 s

const TRANSACTIONS = ['01_Login', '02_Login', '02_ItemView', '03_Search', '04_Item'];

// ---------- Load profile and SLAs ----------
const stages = [{ duration: RAMP, target: VUS }];
if (STEADY !== '0s') stages.push({ duration: STEADY, target: VUS });

const thresholds = {
  // Overall SLAs
  http_req_duration: [{ threshold: `p(95)<${SLA_MS}`, abortOnFail: false }],
  http_req_failed: [`rate<${MAX_ERROR_RATE}`],
  checks: [`rate>${1 - MAX_ERROR_RATE}`],
};
// Per-transaction SLAs, so a slow or failing API is named in the summary
for (const name of TRANSACTIONS) {
  thresholds[`http_req_duration{name:${name}}`] = [`p(95)<${SLA_MS}`];
  thresholds[`http_req_failed{name:${name}}`] = [`rate<${MAX_ERROR_RATE}`];
}

export const options = {
  scenarios: {
    highlevel: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages,
      gracefulRampDown: '10s',
    },
  },
  thresholds,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

// ---------- Helpers (JMeter Random Variable configs) ----------
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
const num = () => randomInt(10000, 99999); // ${Num}
const pageNum = () => randomInt(1, 10);    // ${Pagenum}

// JMeter Uniform Random Timer: 1000 ms constant + 0-2000 ms random = 1-3 s
function thinkTime() {
  sleep(1 + Math.random() * 2);
}

// ---------- Per-VU state (each VU has its own copy, like a JMeter thread) ----------
let token = null;
let tokenTakenAt = 0;

function login(name) {
  const res = http.post(
    `${BASE_URL}/login`,
    JSON.stringify({ username: `aqtar${num()}`, password: 'pass' }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name } }
  );

  // JMeter JSON Extractor: $.token, default TOKEN_NOT_FOUND
  let extracted = 'TOKEN_NOT_FOUND';
  try {
    const t = res.json('token');
    if (t) extracted = t;
  } catch (e) {
    // non-JSON response: keep the default
  }
  check(res, {
    [`${name} status is 2xx`]: (r) => r.status >= 200 && r.status < 300,
    [`${name} token received`]: () => extracted !== 'TOKEN_NOT_FOUND',
  });

  token = extracted;
  tokenTakenAt = Date.now(); // JSR223 PostProcessor: token_taken
}

function authHeaders() {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function itemView() {
  thinkTime();
  const res = http.get(`${BASE_URL}/items?page=${pageNum()}`, {
    headers: authHeaders(),
    tags: { name: '02_ItemView' },
  });
  check(res, { '02_ItemView status < 400': (r) => r.status < 400 });
}

function search() {
  thinkTime();
  const res = http.get(`${BASE_URL}/search?q=term`, {
    headers: authHeaders(),
    tags: { name: '03_Search' },
  });
  check(res, { '03_Search status < 400': (r) => r.status < 400 });
}

function createItem() {
  thinkTime();
  const res = http.post(
    `${BASE_URL}/items`,
    JSON.stringify({ name: `load-test-${num()}-${pageNum()}` }),
    { headers: authHeaders(), tags: { name: '04_Item' } }
  );
  check(res, { '04_Item status < 400': (r) => r.status < 400 });
}

// ---------- Iteration ----------
export default function () {
  // Once Only Controller: first login per VU
  if (token === null) {
    group('01_Login', () => login('01_Login'));
  }

  // If Controller: refresh the token once it is 80 s old
  if (Date.now() - tokenTakenAt >= TOKEN_REFRESH_MS) {
    group('02_Login', () => login('02_Login'));
  }

  if (EXCLUSIVE_MIX) {
    // One transaction per iteration: 50% / 35% / 15%
    const r = Math.random() * 100;
    if (r < 50) group('02_ItemView', itemView);
    else if (r < 85) group('03_Search', search);
    else group('04_Item', createItem);
  } else {
    // Same as JMeter percent Throughput Controllers: each one runs
    // independently on its percentage of iterations
    if (Math.random() < 0.50) group('02_ItemView', itemView);
    if (Math.random() < 0.35) group('03_Search', search);
    if (Math.random() < 0.15) group('04_Item', createItem);
  }
}
