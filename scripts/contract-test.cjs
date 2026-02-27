#!/usr/bin/env node

const http = require("node:http");
const https = require("node:https");
const { URL } = require("node:url");

const BASE_URL =
  process.env.BASE_URL || process.argv[2] || "http://localhost:3000";
const OPENAPI_PATH = "/docs/openapi.json";

const REQUIRED_PATHS = {
  "/auth/register": ["post"],
  "/auth/login": ["post"],
  "/users/profile": ["get"],
  "/users": ["get"],
  "/products": ["get", "post"],
  "/products/{id}": ["get", "put", "delete"],
  "/orders": ["get", "post"],
  "/orders/{id}": ["get"],
  "/orders/{id}/confirm": ["post"],
  "/orders/{id}/cancel": ["post"],
};

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const lib = target.protocol === "https:" ? https : http;
    const { method = "GET", headers = {}, body } = options;
    const requestHeaders = { ...headers };
    let payload;

    if (body !== undefined) {
      payload = typeof body === "string" ? body : JSON.stringify(body);
      if (!requestHeaders["Content-Type"]) {
        requestHeaders["Content-Type"] = "application/json";
      }
      requestHeaders["Content-Length"] = Buffer.byteLength(payload);
    }

    const req = lib.request(
      {
        method,
        hostname: target.hostname,
        port: target.port,
        path: target.pathname + target.search,
        headers: requestHeaders,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
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

    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function fetchJson(url) {
  return requestJson(url, { method: "GET" });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetries(url, attempts = 5, delayMs = 1000) {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await fetchJson(url);
    } catch (err) {
      lastError = err;
      if (i < attempts) {
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
}

async function requestJsonWithRetries(
  url,
  options = {},
  attempts = 5,
  delayMs = 1000,
) {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      return await requestJson(url, options);
    } catch (err) {
      lastError = err;
      if (i < attempts) {
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeMethods(obj) {
  return Object.keys(obj || {}).map((m) => m.toLowerCase());
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertObject(value, message) {
  assert(isObject(value), message);
}

function assertArray(value, message) {
  assert(Array.isArray(value), message);
}

function assertString(value, message) {
  assert(typeof value === "string" && value.length > 0, message);
}

function assertNumber(value, message) {
  assert(typeof value === "number" && Number.isFinite(value), message);
}

function assertNumberOrString(value, message) {
  assert(typeof value === "number" || typeof value === "string", message);
}

function validatePaginatedResponse(payload, label) {
  assertObject(payload, `${label} response should be an object`);
  assert(
    typeof payload.success === "boolean",
    `${label} response missing success boolean`,
  );
  assertArray(payload.data, `${label} response data should be an array`);
  assertObject(payload.meta, `${label} response meta should be an object`);
  assertNumber(
    payload.meta.page,
    `${label} response meta.page should be a number`,
  );
  assertNumber(
    payload.meta.limit,
    `${label} response meta.limit should be a number`,
  );
  assertNumber(
    payload.meta.total,
    `${label} response meta.total should be a number`,
  );
}

function validateProductItem(item) {
  assertObject(item, "Product item should be an object");
  assertString(item.id, "Product item missing id");
  assertString(item.name, "Product item missing name");
  assertNumberOrString(item.price, "Product item missing price");
  assertNumber(item.stock, "Product item missing stock");
}

function validateOrderItem(item) {
  assertObject(item, "Order item should be an object");
  assertString(item.productId, "Order item missing productId");
  assertNumber(item.quantity, "Order item missing quantity");
  if (item.price !== undefined) {
    assertNumberOrString(
      item.price,
      "Order item price should be number or string",
    );
  }
}

function validateOrderRecord(order) {
  assertObject(order, "Order record should be an object");
  assertString(order.id, "Order record missing id");
  assertString(order.userId, "Order record missing userId");
  assertArray(order.items, "Order record items should be an array");
  assertNumberOrString(
    order.total,
    "Order record total should be number or string",
  );
  assertString(order.status, "Order record missing status");
}

async function runResponseValidation() {
  console.log("Validating response schemas for products and orders...");

  const productsUrl = new URL("/api/v1/products", BASE_URL).toString();
  const productsPayload = await fetchJsonWithRetries(productsUrl, 5, 1000);
  validatePaginatedResponse(productsPayload, "GET /api/v1/products");
  if (productsPayload.data.length > 0) {
    validateProductItem(productsPayload.data[0]);
  }
  console.log("Response schema OK: GET /api/v1/products");

  const email = `contract-${Date.now()}@test.com`;
  const password = "test1234";
  const name = "Contract Test";
  const registerUrl = new URL("/api/v1/auth/register", BASE_URL).toString();
  const loginUrl = new URL("/api/v1/auth/login", BASE_URL).toString();

  try {
    await requestJsonWithRetries(
      registerUrl,
      { method: "POST", body: { email, password, name } },
      3,
      500,
    );
  } catch (err) {
    console.warn(`Register failed (continuing to login): ${err.message}`);
  }

  const loginPayload = await requestJsonWithRetries(
    loginUrl,
    { method: "POST", body: { email, password } },
    5,
    1000,
  );
  const token = loginPayload?.data?.token;
  assertString(token, "Login token missing for response validation");

  const ordersUrl = new URL("/api/v1/orders", BASE_URL).toString();
  const ordersPayload = await requestJsonWithRetries(
    ordersUrl,
    { method: "GET", headers: { Authorization: `Bearer ${token}` } },
    5,
    1000,
  );
  validatePaginatedResponse(ordersPayload, "GET /api/v1/orders");
  if (ordersPayload.data.length > 0) {
    validateOrderRecord(ordersPayload.data[0]);
    if (ordersPayload.data[0].items?.length) {
      validateOrderItem(ordersPayload.data[0].items[0]);
    }
  }
  console.log("Response schema OK: GET /api/v1/orders");
}

async function main() {
  const url = new URL(OPENAPI_PATH, BASE_URL).toString();
  console.log(`Fetching OpenAPI spec: ${url}`);

  const spec = await fetchJsonWithRetries(url, 5, 1000);

  assert(spec && spec.openapi, 'OpenAPI spec missing "openapi" field');
  assert(
    spec.paths && typeof spec.paths === "object",
    'OpenAPI spec missing "paths"',
  );

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
      console.error(`Missing paths: ${missingPaths.join(", ")}`);
    }
    if (missingMethods.length) {
      console.error(`Missing methods: ${missingMethods.join(", ")}`);
    }
    process.exit(1);
  }

  await runResponseValidation();

  console.log(
    "Contract test passed: OpenAPI spec matches required paths/methods and response schemas validated.",
  );
}

main().catch((err) => {
  console.error(`Contract test failed: ${err.message}`);
  process.exit(1);
});
