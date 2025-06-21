const fs = require('fs');
const path = require('path');

/**
 * Processes a single uploaded recipe file. This includes sanitizing the filename,
 * validating the file type and size, ensuring a unique filename by appending a
 * timestamp if a conflict exists, moving the file to the designated upload
 * directory, and returning the file's metadata.
 *
 * @param {object} recipe - The file object from express-fileupload.
 *                          Expected to have properties like `name`, `mimetype`, `size`, `mv`.
 * @returns {object} An object containing the processed file's metadata:
 *                   `{ name: string, mimetype: string, size: number }`.
 *                   The `name` will be the sanitized and potentially unique filename.
 * @throws {Error} Throws an error if the file type is invalid,
 *                 if the file size exceeds the maximum limit,
 *                 or if there's an issue moving the file.
 */
function processRecipe(recipe) {
    // Sanitize recipe name: replace any characters not alphanumeric, dot, hyphen, or underscore with an underscore.
    let sanitizedName = recipe.name.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Define allowed MIME types for uploaded files.
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
    // Define maximum allowed file size (e.g., 5MB).
    const maxFileSize = 5 * 1024 * 1024; // 5MB

    // Validate MIME type against the allowed list.
    if (!allowedMimeTypes.includes(recipe.mimetype)) {
        throw new Error('Invalid file type.');
    }

    // Validate file size against the maximum limit.
    if (recipe.size > maxFileSize) {
        throw new Error('File size exceeds limit.');
    }

    // Construct the initial destination path for the file.
    let destinationPath = path.join(process.env.UPLOAD_DIR, sanitizedName);

    // Check if a file with the sanitized name already exists.
    // If it does, generate a unique name to prevent overwriting.
    if (fs.existsSync(destinationPath)) {
        const extension = path.extname(sanitizedName); // Get file extension.
        const baseName = path.basename(sanitizedName, extension); // Get filename without extension.
        // Create a unique name by appending a timestamp before the extension.
        const uniqueName = `${baseName}_${Date.now()}${extension}`;
        sanitizedName = uniqueName; // Update sanitizedName to the new unique version.
        // Update the destination path with the new unique filename.
        destinationPath = path.join(process.env.UPLOAD_DIR, uniqueName);
    }

    // Move the uploaded file to the final destination path.
    console.log("Moving file to:", destinationPath);
    try {
        recipe.mv(destinationPath);
    } catch (err) {
        console.error("Error moving file:", err);
        throw new Error(`Error moving file: ${err.message}`);
    }

    //push file details
    // Return the metadata of the processed file.
    return {
        name: sanitizedName, // This will be the original sanitized name or the unique one.
        mimetype: recipe.mimetype,
        size: recipe.size
    };
}

/**
 * Handles POST requests for uploading one or more recipe files.
 * It checks for necessary server configurations (UPLOAD_DIR),
 * processes each uploaded file using `processRecipe`, and then
 * sends a response indicating success or failure.
 *
 * @param {object} req - The Express request object.
 *                       Expected to contain `req.files` from `express-fileupload`.
 *                       `req.files.recipes` can be a single file object or an array of file objects.
 * @param {object} res - The Express response object. Used to send back HTTP responses.
 *                       On success, sends a 200 response with status `true`, a message,
 *                       and an array of processed file data.
 *                       On configuration error, sends a 500 response with status `false` and an error message.
 *                       On other errors (e.g., from `processRecipe`), sends a 500 response with the error.
 */
exports.postUploadRecipes = function (req, res) {
    try {
        // Check if the UPLOAD_DIR environment variable is set.
        // This is crucial for knowing where to store uploaded files.
        if (!process.env.UPLOAD_DIR) {
            console.error("Server configuration error: Upload directory not specified.");
            return res.status(500).send({
                status: false,
                message: "Server configuration error: Upload directory not specified."
            });
        }

        let data = []; // Array to store metadata of processed files.

        // Check if any files were uploaded.
        if (!req.files || Object.keys(req.files).length === 0 || !req.files.recipes) {
            return res.send({ // Using return here to exit function after sending response.
                status: false,
                message: 'No file uploaded'
            });
        } else {
            // Ensure req.files.recipes is always an array, even if only one file is uploaded.
            // express-fileupload provides a single object for one file, and an array for multiple.
            let recipesArray = Array.isArray(req.files.recipes) ? req.files.recipes : [req.files.recipes];
    
            // Process each uploaded recipe file.
            for (const recipe of recipesArray) {
                const recipeData = processRecipe(recipe); // Process the file.
                data.push(recipeData); // Add processed file metadata to the list.
            };
    
            // Send a success response with the details of the uploaded files.
            return res.send({ // Using return here for consistency.
                status: true,
                message: 'Files are uploaded',
                data: data
            });
        }
    } catch (err) {
        // Catch any errors that occurred during the process (e.g., from processRecipe or other issues).
        console.error("Error in postUploadRecipes:", err); // Log the actual error on the server.
        // Send a generic 500 error response, using err.message if available, otherwise the error object itself.
        res.status(500).send({
            status: false,
            message: err.message || 'An unexpected error occurred.'
        });
    }
};