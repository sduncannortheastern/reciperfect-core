const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const _ = require('lodash');
const router = require('./routes/router.js');
const path = require("path");
const config = require("dotenv").config({ path: path.resolve(__dirname, "config.env") });

const app = express();

// enable files upload
app.use(fileUpload({
    createParentPath: true
}));

//add other middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(morgan('dev'));
console.log('UPLOAD_DIR: ' + process.env.UPLOAD_DIR);
app.use(express.static(process.env.UPLOAD_DIR));

//start app 
const port = process.env.PORT || 3300;

app.listen(port, () => 
  console.log(`App is listening on port ${port}.`)
);

app.post('/upload-recipes', router.postUploadRecipes);