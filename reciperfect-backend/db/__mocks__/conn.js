// reciperfect-backend/db/__mocks__/conn.js

const mockDb = {
  collection: jest.fn().mockReturnThis(), // Allows chaining like .collection('records').find()
  find: jest.fn().mockReturnThis(),
  toArray: jest.fn(),
  findOne: jest.fn(),
  insertOne: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
  // Add any other specific collection methods you expect to use and mock
};

const dbo = {
  connectToServer: jest.fn((callback) => {
    // Simulate successful connection by default for most unit tests
    // If a test needs to simulate a connection error, jest.spyOn can be used.
    if (callback) {
      callback(null);
    }
  }),
  getDb: jest.fn(() => {
    // Return the mockDb object that simulates collection methods
    return mockDb;
  }),
};

module.exports = dbo;
