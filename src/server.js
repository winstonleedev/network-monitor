const path = require('path');
const express = require('express');
const config = require('./config');
const { fetchResults } = require('./db');

function createAuthMiddleware(password) {
  if (!password) {
    return (req, res, next) => next();
  }
  
  return function requirePassword(req, res, next) {
    const header = req.headers.authorization || '';
    const [scheme, encoded] = header.split(' ');

    if (scheme !== 'Basic' || !encoded) {
      return requestPassword(res);
    }

    let decoded;
    try {
      decoded = Buffer.from(encoded, 'base64').toString('utf8');
    } catch (error) {
      return requestPassword(res);
    }

    const [, ...rest] = decoded.split(':');
    const providedPassword = rest.join(':');
    if (providedPassword !== password) {
      return requestPassword(res);
    }

    return next();
  };
}

function requestPassword(res) {
  res.set('WWW-Authenticate', 'Basic realm="Network Monitor"');
  return res.status(401).send('Authentication required');
}

function normalizeRange(startRaw, endRaw) {
  const defaultEnd = Date.now();
  const defaultStart = defaultEnd - 6 * 60 * 60 * 1000;

  const startMs = startRaw ? Date.parse(startRaw) : defaultStart;
  const endMs = endRaw ? Date.parse(endRaw) : defaultEnd;

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    return { startMs: defaultStart, endMs: defaultEnd };
  }
  return { startMs, endMs };
}

function createServer() {
  const app = express();

  app.use(createAuthMiddleware(config.statusPagePassword));

  app.get('/api/status', (req, res) => {
    const { startMs, endMs } = normalizeRange(req.query.start, req.query.end);
    const results = fetchResults(startMs, endMs);

    res.json({
      start: new Date(startMs).toISOString(),
      end: new Date(endMs).toISOString(),
      intervalMinutes: determineIntervalMinutes(startMs, endMs),
      results,
    });
  });

  app.use(express.static(path.join(__dirname, '..', 'public')));

  return app;
}

function determineIntervalMinutes(startMs, endMs) {
  const rangeHours = (endMs - startMs) / (1000 * 60 * 60);
  if (rangeHours <= 6) {
    return 1;
  }
  if (rangeHours <= 24 * 7) {
    return 10;
  }
  return 60;
}

function startServer() {
  const app = createServer();
  return app.listen(config.port, () => {
    console.log(`HTTP server listening on http://localhost:${config.port}`);
  });
}

module.exports = {
  createServer,
  startServer,
};
