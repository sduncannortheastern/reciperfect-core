const express = require("express");
 
// recordRoutes is an instance of the express router.
const recordRoutes = express.Router();
 
// This will help us connect to the database
const dbo = require("../db/conn");
 
// This help convert the id from string to ObjectId for the _id.
const ObjectId = require("mongodb").ObjectId;
 
 
// This section will help you get a list of all the records.
recordRoutes.route("/record").get(function (req, res) {
 let db_connect = dbo.getDb(); // Standardized: Removed "recipes" argument
 if (!db_connect) {
    return res.status(503).json({ error: "Service unavailable: Database connection not initialized." });
 }
 db_connect
   .collection("records")
   .find({})
   .toArray(function (err, result) {
     if (err) {
       console.error("Error fetching records:", err);
       return res.status(500).json({ error: "Internal server error while fetching records" });
     }
     res.json(result);
   });
});
 
// This section will help you get a single record by id
recordRoutes.route("/record/:id").get(function (req, res) { // Changed 'res' to 'response' for consistency in later routes, but kept 'res' here as it was original
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }
  let db_connect = dbo.getDb();
  if (!db_connect) {
    return res.status(503).json({ error: "Service unavailable: Database connection not initialized." });
  }
  let myquery = { _id: ObjectId(req.params.id) };
  db_connect
    .collection("records")
    .findOne(myquery, function (err, result) {
      if (err) {
        console.error("Error fetching record by ID:", err);
        return res.status(500).json({ error: "Internal server error while fetching record" });
      }
      if (!result) {
        return res.status(404).json({ error: "Record not found" });
      }
      res.json(result);
    });
});
 
// This section will help you create a new record.
recordRoutes.route("/record/add").post(function (req, response) {
  let db_connect = dbo.getDb();
  if (!db_connect) {
    return response.status(503).json({ error: "Service unavailable: Database connection not initialized." });
  }
  // TODO: Add validation for req.body content here in a future step
  let myobj = req.body;
  db_connect.collection("records").insertOne(myobj, function (err, insertResult) {
    if (err) {
      console.error("Error inserting new record:", err);
      return response.status(500).json({ error: "Internal server error while adding record" });
    } else {
     // Return 201 Created, the insertedId, and the created document itself
     // To return the document, we'd need another query or for `myobj` to have _id populated by driver (depends on driver/config)
     // For simplicity, returning the ID and a success message.
     // A more complete solution might fetch the document using insertResult.insertedId.
     response.status(201).json({ message: "Record created successfully", insertedId: insertResult.insertedId, acknowledged: insertResult.acknowledged });
    }
  });
});
 
// This section will help you update a record by id.
// Note: Changed route from /update/:id to /record/:id for PUT operation, aligning with RESTful practices.
// Changed method from POST to PUT for updates.
recordRoutes.route("/record/:id").put(function (req, response) {
  if (!ObjectId.isValid(req.params.id)) {
    return response.status(400).json({ error: "Invalid ID format" });
  }
  let db_connect = dbo.getDb();
  if (!db_connect) {
    return response.status(503).json({ error: "Service unavailable: Database connection not initialized." });
  }
  let myquery = { _id: ObjectId(req.params.id) };
  // TODO: Add validation for req.body content here in a future step
  // For now, keeping the specific field update. A more robust solution would dynamically build $set or handle partial updates carefully.
  const updatePayload = { ...req.body }; // Create a shallow copy
  // It's generally not good practice to allow client to set _id in an update payload.
  // If _id is part of req.body, it should ideally be ignored or validated against req.params.id.
  delete updatePayload._id; // Prevent _id field from being part of $set

  let newvalues = {
    $set: updatePayload, // Using the whole body for $set, assuming all fields provided are intentional updates.
                         // Or revert to specific fields if that's the strict requirement:
                         // $set: { name: req.body.name, position: req.body.position, level: req.body.level }
  };

  // Ensure there's something to update if $set is based on specific fields
  // if (Object.keys(newvalues.$set).length === 0) {
  //   return response.status(400).json({ error: "No update fields provided" });
  // }

  db_connect
    .collection("records")
    .updateOne(myquery, newvalues, function (err, updateResult) {
      if (err) {
        console.error("Error updating record:", err);
        return response.status(500).json({ error: "Internal server error while updating record" });
      }
      if (updateResult.matchedCount === 0) {
        return response.status(404).json({ error: "Record not found" });
      }
      // If matchedCount > 0 but modifiedCount === 0, it means the record was found but data was the same.
      // This is usually considered a success.
      console.log("Document update attempt completed. Matched:", updateResult.matchedCount, "Modified:", updateResult.modifiedCount);
      // Optionally, fetch and return the updated document. For now, returning success status.
      response.json({ message: "Record updated successfully", matchedCount: updateResult.matchedCount, modifiedCount: updateResult.modifiedCount });
    });
});
 
// This section will help you delete a record
recordRoutes.route("/record/:id").delete((req, response) => { // Changed path from /:id to /record/:id
  if (!ObjectId.isValid(req.params.id)) {
    return response.status(400).json({ error: "Invalid ID format" });
  }
  let db_connect = dbo.getDb();
  if (!db_connect) {
    return response.status(503).json({ error: "Service unavailable: Database connection not initialized." });
  }
  let myquery = { _id: ObjectId(req.params.id) };
  db_connect.collection("records").deleteOne(myquery, function (err, deleteResult) {
    if (err) {
      console.error("Error deleting record:", err);
      return response.status(500).json({ error: "Internal server error while deleting record" });
    }
    if (deleteResult.deletedCount === 0) {
      return response.status(404).json({ error: "Record not found" });
    }
    console.log("1 document deleted");
    response.status(200).json({ message: "Record deleted successfully", deletedCount: deleteResult.deletedCount });
    // Or use 204 No Content, but then you cannot send a body.
    // response.status(204).send();
  });
});
 
module.exports = recordRoutes;