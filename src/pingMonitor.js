const ping = require('ping');
const config = require('./config');
const { recordPingResult } = require('./db');

async function probeAndRecord() {
  const timestampMs = Date.now();
  try {
    const result = await ping.promise.probe(config.pingTarget, {
      timeout: config.pingTimeoutSeconds,
    });

    const success = Boolean(result.alive);
    const durationMs = Number.isFinite(Number(result.time)) ? Number(result.time) : null;
    const message = success ? null : (result.output && result.output.trim()) || 'Ping failed';

    recordPingResult({ timestampMs, success, durationMs, message });

    return { timestampMs, success, durationMs, message };
  } catch (error) {
    recordPingResult({
      timestampMs,
      success: false,
      durationMs: null,
      message: error.message,
    });
    return { timestampMs, success: false, durationMs: null, message: error.message };
  }
}

function startPingLoop(logger = console) {
  async function tick() {
    try {
      const result = await probeAndRecord();
      logger.info(
        `[ping] ${new Date(result.timestampMs).toISOString()} ${result.success ? 'OK' : 'FAIL'}`
      );
    } catch (error) {
      logger.error(`[ping] Unable to record result: ${error.message}`);
    }
  }

  tick();
  return setInterval(tick, config.pingIntervalMs);
}

module.exports = {
  startPingLoop,
  probeAndRecord,
};
