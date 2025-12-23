const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const config = {
  port: Number(process.env.PORT || 3000),
  statusPagePassword: process.env.STATUS_PAGE_PASSWORD,
  pingTarget: process.env.PING_TARGET || 'apple.com',
  pingIntervalMs: Number(process.env.PING_INTERVAL_MS || 60_000),
  pingTimeoutSeconds: Number(process.env.PING_TIMEOUT_SECONDS || 10),
  databasePath:
    process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'ping.sqlite'),
};

if (!config.statusPagePassword) {
  throw new Error('STATUS_PAGE_PASSWORD is not set. Please create a .env file.');
}

module.exports = config;
