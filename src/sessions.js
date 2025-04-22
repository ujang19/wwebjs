const { Client, RemoteAuth } = require('whatsapp-web.js');
const mongoose = require('mongoose');
const { MongoStore } = require('wwebjs-mongo');  // MongoDB store for session management
const { logger } = require('./logger');  // Logger for logging

// MongoDB URI for session storage
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/whatsapp_sessions';

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    logger.info('Connected to MongoDB for session storage');
  })
  .catch((err) => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);  // Exit if MongoDB connection fails
  });

// Set up the session store using MongoDB
const store = new MongoStore({ mongoose: mongoose });

// Restore sessions from MongoDB
const restoreSessions = () => {
  // Use MongoDB-based session management (no need to use file system logic)
  store.getAllSessions()  // Replace with appropriate MongoDB query to fetch all sessions
    .then((sessionsData) => {
      sessionsData.forEach((sessionData) => {
        setupSession(sessionData.sessionId);  // Restore each session
      });
    })
    .catch((err) => {
      logger.error('Failed to restore sessions from MongoDB', err);
    });
};

// Setup the WhatsApp Web client for each session
const setupSession = async (sessionId) => {
  try {
    // Create client options
    const clientOptions = {
      puppeteer: {
        executablePath: process.env.CHROME_BIN,
        headless: true, // Use headless mode for production
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
      },
      authStrategy: new RemoteAuth({
        store: store, // Use MongoDB store for session management
        backupSyncIntervalMs: 300000, // Sync session data every 5 minutes
      }),
    };

    const client = new Client(clientOptions);
    await client.initialize();
    logger.info(`Session ${sessionId} initialized successfully`);

    // Save session to MongoDB
    store.save({ session: sessionId, client });

  } catch (error) {
    logger.error({ sessionId, err: error }, 'Failed to set up session');
  }
};

module.exports = { restoreSessions, setupSession };
