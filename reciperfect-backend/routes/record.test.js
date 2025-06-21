// reciperfect-backend/routes/record.test.js
const request = require('supertest'); // Although this is more for integration tests, using it for route testing can be okay.
                                     // Alternatively, directly call route functions with mock req/res.
                                     // For this setup, we'll simulate calls to the router.
const express = require('express');
const recordRoutes = require('./record'); // The router we are testing
const dbo = require('../db/conn'); // This will be the mock from __mocks__

// Set up an express app instance and use our recordRoutes
const app = express();
app.use(express.json()); // To parse JSON request bodies if any POST/PUT tests need it
app.use('/', recordRoutes); // Mount the routes under '/' for testing simplicity

// Mock ObjectId.isValid if it's not part of the mock ObjectId itself.
// For these unit tests, we assume ObjectId constructor handles validation or it's pre-validated.
// If ObjectId.isValid is used directly in routes, it might need specific mocking.
// jest.mock('mongodb', () => {
//   const originalMongodb = jest.requireActual('mongodb');
//   return {
//     ...originalMongodb,
//     ObjectId: jest.fn(id => ({ // A simple mock ObjectId constructor
//       toString: () => id,
//       equals: (other) => other && other.toString() === id,
//     })),
//     // ObjectId.isValid needs to be a static method on the mocked ObjectId
//     // This part is tricky with manual mocks vs. jest.mock for full module.
//     // For now, we rely on the actual ObjectId for isValid, or handle it in tests.
//   };
// });


describe('Record Routes - Unit Tests', () => {
  // Reference to the mockDb object from the dbo mock
  let mockDb;

  beforeEach(() => {
    // Clear all mock implementations and calls before each test
    jest.clearAllMocks();
    mockDb = dbo.getDb(); // Get the mockDb instance with its mocked methods
  });

  describe('GET /record', () => {
    it('should return all records successfully', async () => {
      const mockRecords = [{ _id: '1', name: 'Recipe 1' }, { _id: '2', name: 'Recipe 2' }];
      mockDb.toArray.mockImplementationOnce((callback) => callback(null, mockRecords));

      const response = await request(app).get('/record');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRecords);
      expect(mockDb.collection).toHaveBeenCalledWith('records');
      expect(mockDb.find).toHaveBeenCalledWith({});
      expect(mockDb.toArray).toHaveBeenCalledTimes(1);
    });

    it('should return 503 if database is not connected', async () => {
      dbo.getDb.mockReturnValueOnce(null); // Simulate DB not connected

      const response = await request(app).get('/record');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: "Service unavailable: Database connection not initialized." });
    });

    it('should return 500 if database operation fails', async () => {
      mockDb.toArray.mockImplementationOnce((callback) => callback(new Error('DB Error'), null));

      const response = await request(app).get('/record');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error while fetching records' });
    });
  });

  describe('GET /record/:id', () => {
    const validMongoId = '60c72b9f9b1d8c001f8e4d2a'; // Example valid ObjectId string
    const invalidMongoIdFormat = 'invalid-id';

    it('should return a single record successfully', async () => {
      const mockRecord = { _id: validMongoId, name: 'Specific Recipe' };
      mockDb.findOne.mockImplementationOnce((query, callback) => callback(null, mockRecord));

      const response = await request(app).get(`/record/${validMongoId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockRecord);
      expect(mockDb.collection).toHaveBeenCalledWith('records');
      // We expect findOne to be called with an ObjectId, not a string.
      // This requires ObjectId to be either the real one or a mock that works.
      // For unit tests where ObjectId is `require('mongodb').ObjectId`, the real one is used.
      expect(mockDb.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.anything() }), // Check that _id is an ObjectId
        expect.any(Function)
      );
      // More specific check if ObjectId can be easily mocked or its behavior known:
      // expect(mockDb.findOne.mock.calls[0][0]._id.toString()).toEqual(validMongoId);
    });

    it('should return 404 if record not found', async () => {
      mockDb.findOne.mockImplementationOnce((query, callback) => callback(null, null));

      const response = await request(app).get(`/record/${validMongoId}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Record not found' });
    });

    it('should return 400 for invalid ID format', async () => {
      // This test relies on ObjectId.isValid() being called in the route.
      // The actual 'mongodb' module's ObjectId is used here.
      const response = await request(app).get(`/record/${invalidMongoIdFormat}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid ID format' });
    });

    it('should return 503 if database is not connected', async () => {
        dbo.getDb.mockReturnValueOnce(null);

        const response = await request(app).get(`/record/${validMongoId}`);

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ error: "Service unavailable: Database connection not initialized." });
    });

    it('should return 500 if database operation fails', async () => {
      mockDb.findOne.mockImplementationOnce((query, callback) => callback(new Error('DB Error'), null));

      const response = await request(app).get(`/record/${validMongoId}`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error while fetching record' });
    });
  });

  describe('POST /record/add', () => {
    it('should add a new record successfully', async () => {
      const newRecord = { name: 'New Recipe', ingredients: ['test'] };
      const mongoInsertResult = { acknowledged: true, insertedId: 'newGeneratedId123' };
      // mockDb.insertOne is the actual mock function from db/__mocks__/conn.js
      mockDb.insertOne.mockImplementationOnce((doc, callback) => callback(null, mongoInsertResult));

      const response = await request(app)
        .post('/record/add')
        .send(newRecord);

      expect(response.status).toBe(201); // Assuming 201 Created from previous backend refactor
      expect(response.body).toEqual(expect.objectContaining({
        message: "Record created successfully",
        insertedId: mongoInsertResult.insertedId
      }));
      expect(mockDb.collection).toHaveBeenCalledWith('records');
      expect(mockDb.insertOne).toHaveBeenCalledWith(newRecord, expect.any(Function));
    });

    it('should return 503 if database is not connected', async () => {
        dbo.getDb.mockReturnValueOnce(null);
        const newRecord = { name: 'New Recipe' };

        const response = await request(app)
            .post('/record/add')
            .send(newRecord);

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ error: "Service unavailable: Database connection not initialized." });
    });

    it('should return 500 if database operation fails', async () => {
      const newRecord = { name: 'New Recipe Error' };
      mockDb.insertOne.mockImplementationOnce((doc, callback) => callback(new Error('DB Insert Error'), null));

      const response = await request(app)
        .post('/record/add')
        .send(newRecord);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error while adding record' });
    });
  });

  describe('PUT /record/:id', () => {
    const validMongoId = '60c72b9f9b1d8c001f8e4d2a';
    const invalidMongoIdFormat = 'invalid-id';
    const updatePayload = { name: 'Updated Recipe Name', level: 'intermediate' };

    it('should update a record successfully', async () => {
      const mongoUpdateResult = { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
      mockDb.updateOne.mockImplementationOnce((query, newValues, callback) => callback(null, mongoUpdateResult));

      const response = await request(app)
        .put(`/record/${validMongoId}`)
        .send(updatePayload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        message: "Record updated successfully",
        matchedCount: 1,
        modifiedCount: 1
      }));
      expect(mockDb.collection).toHaveBeenCalledWith('records');
      expect(mockDb.updateOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.anything() }), // Check for ObjectId
        { $set: updatePayload }, // Check if $set is used with the payload
        expect.any(Function)
      );
    });

    it('should return 404 if record to update is not found', async () => {
      const mongoUpdateResult = { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
      mockDb.updateOne.mockImplementationOnce((query, newValues, callback) => callback(null, mongoUpdateResult));

      const response = await request(app)
        .put(`/record/${validMongoId}`)
        .send(updatePayload);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Record not found' });
    });

    it('should return 400 for invalid ID format', async () => {
      const response = await request(app)
        .put(`/record/${invalidMongoIdFormat}`)
        .send(updatePayload);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid ID format' });
    });

    it('should return 503 if database is not connected', async () => {
        dbo.getDb.mockReturnValueOnce(null);

        const response = await request(app)
            .put(`/record/${validMongoId}`)
            .send(updatePayload);

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ error: "Service unavailable: Database connection not initialized." });
    });

    it('should return 500 if database operation fails', async () => {
      mockDb.updateOne.mockImplementationOnce((query, newValues, callback) => callback(new Error('DB Update Error'), null));

      const response = await request(app)
        .put(`/record/${validMongoId}`)
        .send(updatePayload);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error while updating record' });
    });

    // Note: The route currently sets all fields from req.body using $set.
    // More specific tests for partial updates or validation of req.body fields
    // would be relevant if the route logic for updates becomes more complex.
  });

  describe('DELETE /record/:id', () => {
    const validMongoId = '60c72b9f9b1d8c001f8e4d2a';
    const invalidMongoIdFormat = 'invalid-id';

    it('should delete a record successfully', async () => {
      const mongoDeleteResult = { acknowledged: true, deletedCount: 1 };
      mockDb.deleteOne.mockImplementationOnce((query, callback) => callback(null, mongoDeleteResult));

      const response = await request(app).delete(`/record/${validMongoId}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(expect.objectContaining({
        message: "Record deleted successfully",
        deletedCount: 1
      }));
      expect(mockDb.collection).toHaveBeenCalledWith('records');
      expect(mockDb.deleteOne).toHaveBeenCalledWith(
        expect.objectContaining({ _id: expect.anything() }), // Check for ObjectId
        expect.any(Function)
      );
    });

    it('should return 404 if record to delete is not found', async () => {
      const mongoDeleteResult = { acknowledged: true, deletedCount: 0 };
      mockDb.deleteOne.mockImplementationOnce((query, callback) => callback(null, mongoDeleteResult));

      const response = await request(app).delete(`/record/${validMongoId}`);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Record not found' });
    });

    it('should return 400 for invalid ID format', async () => {
      const response = await request(app).delete(`/record/${invalidMongoIdFormat}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid ID format' });
    });

    it('should return 503 if database is not connected', async () => {
      dbo.getDb.mockReturnValueOnce(null);

      const response = await request(app).delete(`/record/${validMongoId}`);

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: "Service unavailable: Database connection not initialized." });
    });

    it('should return 500 if database operation fails', async () => {
      mockDb.deleteOne.mockImplementationOnce((query, callback) => callback(new Error('DB Delete Error'), null));

      const response = await request(app).delete(`/record/${validMongoId}`);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error while deleting record' });
    });
  });
});
