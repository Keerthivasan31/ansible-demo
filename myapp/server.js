// =============================================================
//  myapp/server.js
//  Simple Express.js app – deployed by Ansible to EC2
// =============================================================

'use strict';

const express = require('express');
const os      = require('os');
const app     = express();

const PORT     = process.env.PORT     || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const INSTANCE = process.env.INSTANCE_ID || os.hostname();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.url} – from ${req.ip}`);
  next();
});

// ── Routes ───────────────────────────────────────────────────

// Root
app.get('/', (req, res) => {
  res.json({
    status:    'ok',
    message:   '🚀 MyApp is running!',
    instance:  INSTANCE,
    env:       NODE_ENV,
    uptime:    `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
});

// Health check (used by Nginx & load balancers)
app.get('/health', (req, res) => {
  res.status(200).json({
    status:   'healthy',
    pid:      process.pid,
    memory:   process.memoryUsage(),
    uptime:   process.uptime(),
    hostname: os.hostname(),
  });
});

// System info
app.get('/info', (req, res) => {
  res.json({
    node:      process.version,
    platform:  process.platform,
    arch:      process.arch,
    cpus:      os.cpus().length,
    totalMem:  `${Math.round(os.totalmem() / 1024 / 1024)} MB`,
    freeMem:   `${Math.round(os.freemem()  / 1024 / 1024)} MB`,
    loadAvg:   os.loadavg(),
    instance:  INSTANCE,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', path: req.url });
});

// Error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ MyApp started on port ${PORT} | env=${NODE_ENV} | pid=${process.pid}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received – shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
