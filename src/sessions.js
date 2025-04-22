const mongoose = require('mongoose');
const { Client, RemoteAuth } = require('whatsapp-web.js');
const { MongoStore } = require('wwebjs-mongo');  // Import MongoStore
const { logger } = require('./logger');

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
const restoreSessions = async () => {
  try {
    // Fetch all session records from the MongoDB "sessions" collection
    const sessionsData = await mongoose.connection.db.collection('sessions').find().toArray();

    sessionsData.forEach((sessionData) => {
      const sessionId = sessionData.sessionId;
      logger.warn({ sessionId }, 'Existing session detected');
      setupSession(sessionId, sessionData);  // Call setupSession to initialize each session
    });
  } catch (err) {
    logger.error('Failed to restore sessions from MongoDB', err);
  }
};

// Setup the WhatsApp Web client for each session
const setupSession = async (sessionId, sessionData) => {
  try {
    const clientOptions = {
      puppeteer: {
        executablePath: process.env.CHROME_BIN,
        headless: true,  // Use headless mode for production
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
      },
      authStrategy: new RemoteAuth({
        store: store,  // Use MongoDB store for session management
        backupSyncIntervalMs: 300000,  // Sync session data every 5 minutes
      }),
    };

    const client = new Client(clientOptions);
    await client.initialize();
    logger.info(`Session ${sessionId} initialized successfully`);

    // Optionally save session data to MongoDB
    store.save({ session: sessionId, client });

  } catch (error) {
    logger.error({ sessionId }, 'Failed to set up session');
  }
};

module.exports = { restoreSessions, setupSession };
