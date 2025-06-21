// reciperfect-backend/test/integration/api.test.js
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { MongoClient } = require('mongodb'); // To connect to the in-memory server if needed for setup/assertions
const app = require('../../server'); // Adjust path to your Express app
const dbo = require('../../db/conn'); // Actual dbo to connect to test DB

let mongod;
let mongoClient;
let testDb;

// Overriding environment variables for the test execution
// These would ideally be set in a jest.setup.js or via Jest's globalSetup/globalTeardown
// For now, setting them here before app is fully initialized by tests.
// This is a bit tricky as server.js loads dotenv and dbo immediately.
// A better approach is to ensure server.js can be initialized with a DB connection later,
// or that dbo.connectToServer can be called multiple times with different URIs.

// For this test, we will rely on jest.setup.js to set these before server.js is imported. // This comment is now less relevant due to server.js changes
// If jest.setup.js is not used, then server.js would need to be refactored
// to delay DB connection until a specific init function is called with a URI. // This was done.

// Let's assume jest.setup.js will handle setting these: // We are setting them here now.
// process.env.DB_URI
// process.env.DB_NAME = "test_integration_db"
// process.env.PORT = some_test_port

const serverModule = require('../../server'); // Import the whole module
const expressApp = serverModule.app; // The Express app instance

let mongod;
let mongoClient; // For direct DB interaction for setup/teardown
let testDb;      // For direct DB interaction

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  process.env.DB_URI = uri;
  process.env.DB = 'test_integration_db';
  process.env.PORT = '5001'; // Use a different port for tests to avoid conflict

  // Connect our own client for setup/teardown
  mongoClient = new MongoClient(uri);
  await mongoClient.connect();
  testDb = mongoClient.db(process.env.DB);

  // Start the server
  await new Promise((resolve, reject) => {
    serverModule.startServer((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}, 60000); // Increased timeout for MongoDB Memory Server download and server start

afterAll(async () => {
  await new Promise(resolve => serverModule.closeServer(resolve)); // Close the server
  if (mongoClient) {
    await mongoClient.close();
  }
  if (mongod) {
    await mongod.stop();
  }
});

beforeEach(async () => {
  // Clear all collections in the test database before each test
  const collections = await testDb.listCollections().toArray();
  for (const collection of collections) {
    await testDb.collection(collection.name).deleteMany({});
  }
});


describe('API Integration Tests', () => {
  let createdRecordId;
  const initialRecord = { name: 'Integration Test Recipe', ingredients: ['water', 'test'], level: "easy" };

  it('should respond with a 404 for an unknown route', async () => {
    const response = await request(expressApp).get('/nonexistentroute');
    expect(response.status).toBe(404);
  });

  // --- Test Suite Order ---
  // 1. POST
  // 2. GET by ID (using ID from POST)
  // 3. GET all (verifying the POSTed record is there)
  // 4. PUT (on the POSTed record)
  // 5. DELETE (on the POSTed record)
  // 6. GET by ID (for deleted record, expect 404)

  it('1. POST /record/add - should create a new record', async () => {
    const response = await request(expressApp)
      .post('/record/add')
      .send(initialRecord)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(response.body).toHaveProperty('message', 'Record created successfully');
    expect(response.body).toHaveProperty('insertedId');
    expect(response.body.acknowledged).toBe(true);
    createdRecordId = response.body.insertedId;
  });

  it('2. GET /record/:id - should return the created record', async () => {
    expect(createdRecordId).toBeDefined();
    const response = await request(expressApp)
      .get(`/record/${createdRecordId}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body._id).toBe(createdRecordId);
    expect(response.body.name).toBe(initialRecord.name);
    expect(response.body.level).toBe(initialRecord.level);
  });

  it('3. GET /record - should return all records, including the new one', async () => {
    const response = await request(expressApp)
      .get('/record')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(1);
    expect(response.body[0]._id).toBe(createdRecordId);
  });

  it('4. PUT /record/:id - should update the created record', async () => {
    expect(createdRecordId).toBeDefined();
    const updatedData = { name: 'Updated Recipe Name', level: 'intermediate (updated)' };
    const response = await request(expressApp)
      .put(`/record/${createdRecordId}`)
      .send(updatedData)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.message).toBe('Record updated successfully');
    expect(response.body.matchedCount).toBe(1);
    expect(response.body.modifiedCount).toBe(1);

    // Verify the update by fetching the record again
    const verifyResponse = await request(expressApp).get(`/record/${createdRecordId}`);
    expect(verifyResponse.body.name).toBe(updatedData.name);
    expect(verifyResponse.body.level).toBe(updatedData.level);
  });

  it('5. DELETE /record/:id - should delete the created record', async () => {
    expect(createdRecordId).toBeDefined();
    const response = await request(expressApp)
      .delete(`/record/${createdRecordId}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.message).toBe('Record deleted successfully');
    expect(response.body.deletedCount).toBe(1);
  });

  it('6. GET /record/:id - should return 404 for the deleted record', async () => {
    expect(createdRecordId).toBeDefined();
    await request(expressApp)
      .get(`/record/${createdRecordId}`)
      .expect('Content-Type', /json/)
      .expect(404);
  });

  // --- Standalone Error Case Tests ---
  it('GET /record/:id - should return 404 for a non-existent ID', async () => {
    const nonExistentId = '123456789012345678901234';
    await request(expressApp)
      .get(`/record/${nonExistentId}`)
      .expect('Content-Type', /json/)
      .expect(404);
  });

  it('GET /record/:id - should return 400 for an invalid ID format', async () => {
    const invalidId = 'invalid-id-format';
    await request(expressApp)
      .get(`/record/${invalidId}`)
      .expect('Content-Type', /json/)
      .expect(400);
  });

  it('PUT /record/:id - should return 404 for updating a non-existent ID', async () => {
    const nonExistentId = '123456789012345678901234';
    const updatedData = { name: 'No one will see this' };
    await request(expressApp)
        .put(`/record/${nonExistentId}`)
        .send(updatedData)
        .expect('Content-Type', /json/)
        .expect(404);
  });

  it('PUT /record/:id - should return 400 for updating with an invalid ID format', async () => {
    const invalidId = 'invalid-id-format';
    const updatedData = { name: 'No one will see this' };
    await request(expressApp)
        .put(`/record/${invalidId}`)
        .send(updatedData)
        .expect('Content-Type', /json/)
        .expect(400);
  });

  it('DELETE /record/:id - should return 404 for deleting a non-existent ID', async () => {
    const nonExistentId = '123456789012345678901234';
    await request(expressApp)
        .delete(`/record/${nonExistentId}`)
        .expect('Content-Type', /json/)
        .expect(404);
  });

  it('DELETE /record/:id - should return 400 for deleting with an invalid ID format', async () => {
    const invalidId = 'invalid-id-format';
    await request(expressApp)
        .delete(`/record/${invalidId}`)
        .expect('Content-Type', /json/)
        .expect(400);
  });
});
