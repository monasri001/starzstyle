import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const port = Number.parseInt(process.env.PORT || "8080", 10);
const hostname = process.env.APP_HOST || "0.0.0.0";
const rootDirectory = path.dirname(fileURLToPath(import.meta.url));
const staticDirectory = path.join(rootDirectory, "out");
const maxBodyBytes = 100_000;

// This is the authoritative server-side catalogue. Never trust prices supplied
// by a browser when calculating or storing an order.
const catalogue = new Map([
  [1, { name: "Emerald Drape Midi", color: "Emerald", price: 3890 }],
  [2, { name: "Noir Pleated Gown", color: "Black", price: 6490 }],
  [3, { name: "Ivory Noor Anarkali", color: "Ivory", price: 7990 }],
  [4, { name: "Verdant One-Shoulder", color: "Green", price: 4290 }],
  [5, { name: "After Dark Column", color: "Noir", price: 5790 }],
  [6, { name: "Zari Moonlight Set", color: "Gold", price: 8490 }],
]);

const databaseVariables = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASS"];
const missingDatabaseVariables = databaseVariables.filter((name) => !process.env[name]);
const pool = missingDatabaseVariables.length === 0
  ? new Pool({
      host: process.env.DB_HOST,
      port: Number.parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      max: Number.parseInt(process.env.DB_POOL_MAX || "5", 10),
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      ssl: process.env.DB_SSL === "false"
        ? false
        : { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" },
    })
  : null;

const schemaStatements = `
  CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    order_number VARCHAR(64) UNIQUE NOT NULL,
    customer_name VARCHAR(120) NOT NULL,
    delivery_address TEXT NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    placed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL,
    product_name VARCHAR(160) NOT NULL,
    color VARCHAR(80) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0)
  );

  CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
`;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function normalizeOrder(input) {
  if (!input || typeof input !== "object") return null;

  const orderNumber = typeof input.orderNumber === "string" ? input.orderNumber.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const address = typeof input.address === "string" ? input.address.trim() : "";
  const placedAt = new Date(input.placedAt);

  if (
    !/^SS-[A-Z0-9-]{6,40}$/.test(orderNumber)
    || name.length < 2
    || name.length > 120
    || address.length < 5
    || address.length > 1_000
    || Number.isNaN(placedAt.getTime())
    || !Array.isArray(input.items)
    || input.items.length === 0
    || input.items.length > 50
  ) {
    return null;
  }

  const items = [];
  for (const item of input.items) {
    const productId = Number(item?.product?.id);
    const quantity = Number(item?.quantity);
    const product = catalogue.get(productId);
    if (!product || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20) return null;
    items.push({ productId, quantity, ...product });
  }

  return {
    orderNumber,
    name,
    address,
    placedAt,
    items,
    subtotal: items.reduce((total, item) => total + item.price * item.quantity, 0),
  };
}

async function saveOrder(order) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const orderResult = await client.query(
      `INSERT INTO orders
        (order_number, customer_name, delivery_address, subtotal, placed_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, order_number, created_at`,
      [order.orderNumber, order.name, order.address, order.subtotal, order.placedAt],
    );
    const orderId = orderResult.rows[0].id;

    for (const item of order.items) {
      await client.query(
        `INSERT INTO order_items
          (order_id, product_id, product_name, color, unit_price, quantity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [orderId, item.productId, item.name, item.color, item.price, item.quantity],
      );
    }

    await client.query("COMMIT");
    return orderResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function handleCreateOrder(request, response) {
  if (!pool) {
    sendJson(response, 503, {
      code: "RDS_NOT_CONFIGURED",
      message: "RDS is not configured on this server.",
    });
    return;
  }

  try {
    const order = normalizeOrder(await readJson(request));
    if (!order) {
      sendJson(response, 400, { message: "Invalid order details." });
      return;
    }

    const savedOrder = await saveOrder(order);
    sendJson(response, 201, {
      orderNumber: savedOrder.order_number,
      subtotal: order.subtotal,
      savedAt: savedOrder.created_at,
    });
  } catch (error) {
    if (error.message === "REQUEST_TOO_LARGE") {
      sendJson(response, 413, { message: "Order request is too large." });
      return;
    }
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { message: "Request body must be valid JSON." });
      return;
    }
    if (error.code === "23505") {
      sendJson(response, 409, { message: "This order has already been stored." });
      return;
    }

    console.error("[StarzStyle] Unable to store order", error);
    sendJson(response, 500, { message: "Unable to store the order in RDS." });
  }
}

async function handleHealth(response) {
  if (!pool) {
    sendJson(response, 503, { website: "ok", database: "not configured" });
    return;
  }

  try {
    await pool.query("SELECT 1");
    sendJson(response, 200, { website: "ok", database: "connected" });
  } catch (error) {
    console.error("[StarzStyle] RDS health check failed", error);
    sendJson(response, 503, { website: "ok", database: "unavailable" });
  }
}

async function serveStatic(request, response, pathname) {
  let relativePath;
  try {
    relativePath = decodeURIComponent(pathname === "/" ? "index.html" : pathname.slice(1));
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  let filePath = path.resolve(staticDirectory, relativePath);
  if (filePath !== staticDirectory && !filePath.startsWith(`${staticDirectory}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  try {
    const fileStats = await stat(filePath);
    if (fileStats.isDirectory()) filePath = path.join(filePath, "index.html");
    await stat(filePath);
  } catch {
    filePath = path.join(staticDirectory, "404.html");
    response.statusCode = 404;
  }

  response.setHeader("content-type", contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream");
  if (filePath.includes(`${path.sep}_next${path.sep}static${path.sep}`)) {
    response.setHeader("cache-control", "public, max-age=31536000, immutable");
  }

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(filePath)
    .on("error", (error) => {
      console.error("[StarzStyle] Static file error", error);
      if (!response.headersSent) response.writeHead(500);
      response.end();
    })
    .pipe(response);
}

async function initializeDatabase() {
  if (!pool) {
    console.warn(`[StarzStyle] RDS disabled; missing ${missingDatabaseVariables.join(", ")}.`);
    return;
  }

  await pool.query(schemaStatements);
  console.log("[StarzStyle] RDS connected and order tables are ready.");
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/health" && request.method === "GET") {
    await handleHealth(response);
    return;
  }
  if (url.pathname === "/api/orders" && request.method === "POST") {
    await handleCreateOrder(request, response);
    return;
  }
  if (url.pathname.startsWith("/api/")) {
    sendJson(response, 404, { message: "API route not found." });
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }

  await serveStatic(request, response, url.pathname);
});

try {
  await initializeDatabase();
  server.listen(port, hostname, () => {
    console.log(`[StarzStyle] Website and order API listening on http://${hostname}:${port}`);
  });
} catch (error) {
  console.error("[StarzStyle] RDS startup failed. Check DB settings and security groups.", error);
  process.exit(1);
}

async function shutdown(signal) {
  console.log(`[StarzStyle] ${signal} received; shutting down.`);
  server.close(async () => {
    if (pool) await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
