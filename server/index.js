require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const { initializeDatabase, getDatabase, getSetting } = require('./database/db');
const { errorHandler, notFoundHandler, logger } = require('./middleware/errorHandler');
const { requestLogger } = require('./middleware/logging');

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const repairRoutes = require('./routes/repairs');
const serviceRoutes = require('./routes/services');
const invoiceRoutes = require('./routes/invoices');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const digitalServiceRoutes = require('./routes/digitalServices');
const airtableRoutes = require('./routes/airtable');
const mailgunRoutes = require('./routes/omnisend'); // Using same route file, now with Mailgun
const exportRoutes = require('./routes/exports');
const backupRoutes = require('./routes/backup');
const blogRoutes = require('./routes/blog');

const airtableSync = require('./services/airtableSync');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

const logsDir = path.join(__dirname, 'logs');
const backupsDir = path.join(__dirname, 'backups');
const generatedDir = path.join(__dirname, 'generated');

[logsDir, backupsDir, generatedDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(requestLogger);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    success: false,
    error: 'Too many requests',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    error: 'Too many login attempts',
    message: 'Please try again after 15 minutes'
  }
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.get('/api/health', (req, res) => {
  const db = getDatabase();
  let dbStatus = 'unknown';
  
  try {
    db.prepare('SELECT 1').get();
    dbStatus = 'connected';
  } catch (error) {
    dbStatus = 'disconnected';
  }
  
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus,
    uptime: process.uptime()
  });
});

app.get('/api/info', (req, res) => {
  const businessName = getSetting('business_name') || 'ByteCare';
  const businessPhone = getSetting('business_phone') || '';
  const businessEmail = getSetting('business_email') || '';
  const themeColor = getSetting('theme_color') || '#2563eb';
  
  res.json({
    success: true,
    data: {
      name: businessName,
      phone: businessPhone,
      email: businessEmail,
      theme_color: themeColor,
      version: '1.0.0'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/repairs', repairRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/digital-services', digitalServiceRoutes);
app.use('/api/airtable', airtableRoutes);
app.use('/api/mailgun', mailgunRoutes);
app.use('/api/exports', exportRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/blog', blogRoutes);

app.use('/generated', express.static(path.join(__dirname, 'generated')));

if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
  
  if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
    
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    });
  }
}

app.use(notFoundHandler);

app.use(errorHandler);

let syncInterval = null;

function startAirtableSync() {
  const syncEnabled = getSetting('airtable_sync_enabled') === '1';
  const syncIntervalMinutes = parseInt(getSetting('airtable_sync_interval') || '30');
  
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  
  if (syncEnabled) {
    logger.info(`Starting Airtable sync every ${syncIntervalMinutes} minutes`);
    
    syncInterval = setInterval(async () => {
      try {
        logger.info('Running scheduled Airtable sync...');
        await airtableSync.syncAll();
        logger.info('Scheduled Airtable sync completed');
      } catch (error) {
        logger.error('Scheduled Airtable sync failed:', error.message);
      }
    }, syncIntervalMinutes * 60 * 1000);
  }
}

async function startServer() {
  try {
    logger.info('Initializing database...');
    initializeDatabase();
    logger.info('Database initialized successfully');
    
    startAirtableSync();
    
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ByteCare Management System                               ║
║   Server running on port ${PORT}                             ║
║                                                            ║
║   Environment: ${(process.env.NODE_ENV || 'development').padEnd(40)}║
║   API Base URL: http://localhost:${PORT}/api                  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();

module.exports = app;
