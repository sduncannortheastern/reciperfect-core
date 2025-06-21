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
 
app.listen(port, () => {
  // Perform a database connection when server starts
  dbo.connectToServer(function (err) {
    if (err) {
      console.error("FATAL ERROR: Failed to connect to the database.", err);
      process.exit(1); // Exit the process with an error code
    } else {
      console.log(`Successfully connected to database. Server is running on port: ${port}`);
    }
  });
});