const config = require('./config');
const { startPingLoop } = require('./pingMonitor');
const { startServer } = require('./server');

console.log(`Starting network monitor targeting ${config.pingTarget}`);

startPingLoop();
startServer();
