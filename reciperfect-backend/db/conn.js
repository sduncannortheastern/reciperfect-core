const { MongoClient } = require("mongodb");

const DbURI = process.env.DB_URI;
const DbName = process.env.DB;

if (!DbURI) {
  console.error("FATAL ERROR: DB_URI environment variable is not defined.");
  process.exit(1);
}
if (!DbName) {
  console.error("FATAL ERROR: DB environment variable (database name) is not defined.");
  process.exit(1);
}

const client = new MongoClient(DbURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
 
var _db;
 
module.exports = {
  connectToServer: function (callback) {
    client.connect(function (err, dbClient) { // Renamed 'db' to 'dbClient' for clarity
      // Verify we got a good "dbClient" object (the connected client instance)
      if (err) {
        // If client.connect itself calls back with an error
        return callback(err);
      }
      if (dbClient) {
        _db = dbClient.db(DbName); // Use the checked DbName
        console.log("Successfully connected to MongoDB and database:", DbName);
      } else {
        // This case should ideally be covered by `err` from client.connect,
        // but as a safeguard if dbClient is unexpectedly null/undefined without an error.
        return callback(new Error("MongoDB client not available after connect."));
      }
      return callback(null); // Explicitly pass null for error if connection is successful
         });
  },
 
  getDb: function () {
    if (!_db) {
      // This situation should ideally be prevented by robust startup logic in server.js
      console.error("CRITICAL: getDb called before database was initialized or connection failed.");
      // Depending on the application strategy, you might throw an error here,
      // but server.js should prevent requests if _db is not set.
    }
    return _db;
  },
};