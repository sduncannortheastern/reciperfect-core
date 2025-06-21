const express = require("express");
const app = express();
const cors = require("cors");
const path = require("path");

// Load environment variables
const dotenvResult = require("dotenv").config({ path: path.resolve(__dirname, "config.env") });

if (dotenvResult.error) {
  console.warn("Warning: Error loading .env file:", dotenvResult.error.message);
  // Depending on the severity, you might choose to exit if critical env vars are expected from the file
  // For now, we'll allow the server to attempt to start, as env vars might be set externally.
}

const port = process.env.PORT || 5000; // Fallback to port 5000 if not specified

app.use(cors());
app.use(express.json());
app.use(require("./routes/record.js"));

// Get driver connection
const dbo = require("./db/conn.js"); // This will already have checked DB_URI and DB_NAME due to changes in conn.js

let serverInstance; // To hold the server instance for potential closing

function startServer(callback) {
  if (serverInstance && serverInstance.listening) {
    console.log('Server is already running.');
    if (callback) callback();
    return;
  }

  // Perform a database connection when server starts
  dbo.connectToServer(function (err) {
    if (err) {
      console.error("FATAL ERROR: Failed to connect to the database.", err);
      if (callback) return callback(err); // Pass error to callback
      process.exit(1); // Exit if no callback to handle error
    } else {
      console.log(`Successfully connected to database.`);
      serverInstance = app.listen(port, () => {
        console.log(`Server is running on port: ${port}`);
        if (callback) callback(); // Signal server is ready
      });
      serverInstance.on('error', (e) => { // Handle server errors like EADDRINUSE
        console.error('Server error:', e.message);
        if (callback) callback(e);
        // Do not process.exit(1) here, allow tests or caller to handle
      });
    }
  });
}

function closeServer(callback) {
  if (serverInstance) {
    serverInstance.close(err => {
      if (err) {
        console.error("Error closing server:", err);
        if (callback) return callback(err);
      }
      console.log("Server closed.");
      // Also close DB connection if necessary, though dbo doesn't expose close right now
      // For tests, the in-memory server is stopped, which is usually sufficient.
      serverInstance = null;
      if (callback) callback();
    });
  } else {
    if (callback) callback();
  }
}

// If this file is run directly (e.g., `node server.js`), start the server.
// If it's imported (e.g., by tests), the exported functions can be used.
if (require.main === module) {
  startServer((err) => {
    if (err) {
      console.error("Failed to start server for direct execution:", err);
      // process.exit(1) might have already been called by startServer's dbo.connectToServer callback
    }
  });
}

module.exports = { app, startServer, closeServer, dbo }; // Export app for supertest, dbo for direct test DB interaction
});