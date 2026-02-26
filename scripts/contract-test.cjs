#!/usr/bin/env node

const http = require('node:http');
const https = require('node:https');
const { URL } = require('node:url');

const BASE_URL = process.env.BASE_URL || process.argv[2] || 'http://localhost:3000';
const OPENAPI_PATH = '/docs/openapi.json';

const REQUIRED_PATHS = {
  '/auth/register': ['post'],
  '/auth/login': ['post'],
  '/users/profile': ['get'],
  '/users': ['get'],
  '/products': ['get', 'post'],
  '/products/{id}': ['get', 'put', 'delete'],
  '/orders': ['get', 'post'],
  '/orders/{id}': ['get'],
  '/orders/{id}/confirm': ['post'],
  '/orders/{id}/cancel': ['post'],
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const lib = target.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        method: 'GET',
        hostname: target.hostname,
        port: target.port,
        path: target.pathname + target.search,
      },
      (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch (err) {
              reject(new Error(`Failed to parse JSON: ${err.message}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      },
    );

    req.on('error', reject);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeMethods(obj) {
  return Object.keys(obj || {}).map((m) => m.toLowerCase());
}

async function main() {
  const url = new URL(OPENAPI_PATH, BASE_URL).toString();
  console.log(`Fetching OpenAPI spec: ${url}`);

  const spec = await fetchJson(url);

  assert(spec && spec.openapi, 'OpenAPI spec missing "openapi" field');
  assert(spec.paths && typeof spec.paths === 'object', 'OpenAPI spec missing "paths"');

  const missingPaths = [];
  const missingMethods = [];

  for (const [path, methods] of Object.entries(REQUIRED_PATHS)) {
    const pathItem = spec.paths[path];
    if (!pathItem) {
      missingPaths.push(path);
      continue;
    }

    const available = normalizeMethods(pathItem);
    for (const method of methods) {
      if (!available.includes(method)) {
        missingMethods.push(`${method.toUpperCase()} ${path}`);
      }
    }
  }

  if (missingPaths.length || missingMethods.length) {
    if (missingPaths.length) {
      console.error(`Missing paths: ${missingPaths.join(', ')}`);
    }
    if (missingMethods.length) {
      console.error(`Missing methods: ${missingMethods.join(', ')}`);
    }
    process.exit(1);
  }

  console.log('Contract test passed: OpenAPI spec matches required paths/methods.');
}

main().catch((err) => {
  console.error(`Contract test failed: ${err.message}`);
  process.exit(1);
});
