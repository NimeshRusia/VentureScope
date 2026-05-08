const express = require('express');
const cors = require('cors');
const { frontendOrigin } = require('./config');
const opportunitiesRouter = require('./routes/opportunities');
const contextRouter = require('./routes/context');
const soulSyncRouter = require('./routes/soul-sync');
const copilotRouter = require('./routes/copilot');

function createApp() {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        // Allow server-to-server requests (no Origin header)
        if (!origin) return callback(null, true);

        if (frontendOrigin.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`CORS blocked for origin ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => {
    res.json({ ok: true });
  });

  app.use('/opportunities', opportunitiesRouter);
  app.use('/context', contextRouter);
  app.use('/copilot',    copilotRouter);
  app.use('/soul-sync',  soulSyncRouter);
  app.use('/logs',    require('./routes/logs'));
  app.use('/digest',  require('./routes/digest'));
  app.use('/papers',  require('./routes/papers'));

  app.use((error, req, res, next) => {
    if (error?.message?.startsWith('CORS blocked for origin')) {
      return res.status(403).json({
        error: error.message,
      });
    }

    return next(error);
  });

  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({
      error: 'Unexpected server error',
    });
  });

  return app;
}

module.exports = {
  createApp,
};