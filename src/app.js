require('./routes');
const express = require('express');
const mongoose = require('mongoose');
const { MongoStore } = require('wwebjs-mongo');  // MongoDB store for session management
const { Client, RemoteAuth } = require('whatsapp-web.js');  // WhatsApp Web client and RemoteAuth strategy
const { restoreSessions } = require('./sessions');  // Import session management logic
const { logger } = require('./logger');  // Logger utility
const { baseWebhookURL, maxAttachmentSize } = require('./config');  // Config imports
const { handleUpgrade } = require('./websocket');  // WebSocket upgrade handling

const app = express();

// MongoDB URI for session storage (use your environment variable or fallback to localhost)
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/whatsapp_sessions';

// Connect to MongoDB for session storage
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    logger.info('Connected to MongoDB for session storage');
  })
  .catch((err) => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);  // Exit if MongoDB connection fails
  });

// Create MongoStore instance for session management
const store = new MongoStore({ mongoose: mongoose });

// Initialize WhatsApp Web client with RemoteAuth and MongoDB session store
const client = new Client({
  authStrategy: new RemoteAuth({
    store: store,  // Use MongoDB store for session management
    backupSyncIntervalMs: 300000,  // Sync session data every 5 minutes
  }),
  puppeteer: { headless: true },  // Set to true for headless mode (useful in production)
});

// Handle client ready event
client.on('ready', () => {
  logger.info('WhatsApp Web client is ready!');
});

// Start the WhatsApp Web client
client.initialize();

// Initialize Express app
app.disable('x-powered-by');
app.use(express.json({ limit: maxAttachmentSize + 1000000 }));
app.use(express.urlencoded({ limit: maxAttachmentSize + 1000000, extended: true }));

// Call restoreSessions to restore existing sessions from MongoDB
restoreSessions();

// Set up WebSocket handling if enabled
const server = app.listen(process.env.PORT || 3000, () => {
  logger.info(`Server running on port ${server.address().port}`);
});

// WebSocket upgrade handling if enabled
if (baseWebhookURL && process.env.ENABLE_WEBSOCKET) {
  server.on('upgrade', (request, socket, head) => {
    handleUpgrade(request, socket, head);
  });
}

// Disable the warnings when you start more than 10 browser instances
process.setMaxListeners(0);

module.exports = app;  // Export app for server.js to use
