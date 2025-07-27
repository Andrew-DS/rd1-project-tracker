// config/db.js
const sql = require('mssql');
const baseConfig = require('./dbConfig'); // <-- your existing env-based config

// Merge your config with some sane defaults (without breaking your prod/dev files)
const config = {
    ...baseConfig,
    connectionTimeout: baseConfig.connectionTimeout ?? 30000,
    requestTimeout: baseConfig.requestTimeout ?? 30000,
    pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000,
        ...(baseConfig.pool || {})
    },
    options: {
        encrypt: true,
        trustServerCertificate: false,
        ...(baseConfig.options || {})
    }
};

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 750;
const MAX_DELAY_MS = 8000;

let poolPromise;

function backoffDelay(attempt) {
    const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * Math.pow(2, attempt));
    const jitter = Math.random() * 0.3 * exp;
    return Math.floor(exp + jitter);
}

async function connectWithRetry() {
    let lastErr;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const pool = await new sql.ConnectionPool(config).connect();
            pool.on('error', err => {
                console.error('SQL pool error, resetting poolPromise:', err);
                poolPromise = undefined;
            });
            console.log('Connected to SQL');
            return pool;
        } catch (err) {
            lastErr = err;
            const shouldRetry =
                err.code === 'ETIMEOUT' ||
                err.code === 'ESOCKET' ||
                err.message?.toLowerCase().includes('timeout') ||
                err.message?.toLowerCase().includes('paused');

            if (!shouldRetry || attempt === MAX_RETRIES - 1) {
                console.error('SQL connect failed (final):', err);
                throw err;
            }

            const delay = backoffDelay(attempt);
            console.warn(
                `SQL connect failed (attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${delay}ms...`,
                err.message
            );
            await new Promise(res => setTimeout(res, delay));
        }
    }
    throw lastErr;
}

async function getPool() {
    if (!poolPromise) {
        poolPromise = connectWithRetry();
    }
    return poolPromise;
}

async function queryWithRetry(query, paramsFn) {
    let lastErr;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            const pool = await getPool();
            const req = pool.request();
            if (typeof paramsFn === 'function') paramsFn(req);
            return await req.query(query);
        } catch (err) {
            lastErr = err;

            // If connection broke, force a reconnect on next try
            if (err.code === 'ETIMEOUT' || err.code === 'ESOCKET') {
                poolPromise = undefined;
            }

            if (attempt === MAX_RETRIES - 1) throw err;

            const delay = backoffDelay(attempt);
            console.warn(
                `Query failed (attempt ${attempt + 1}/${MAX_RETRIES}). Retrying in ${delay}ms...`,
                err.message
            );
            await new Promise(res => setTimeout(res, delay));
        }
    }
    throw lastErr;
}

module.exports = {
    sql,
    getPool,
    queryWithRetry
};