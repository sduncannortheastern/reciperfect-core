function processRecipe(recipe, data) {
     //move photo to uploads directory
     console.log(process.env.UPLOAD_DIR + recipe.name );
     recipe.mv(process.env.UPLOAD_DIR + recipe.name);

     //push file details
     data.push({
         name: recipe.name,
         mimetype: recipe.mimetype,
         size: recipe.size
     });
}

exports.postUploadRecipes = function (req, res) {
    try {
        let data = [];

        if(!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            //let data = []; 
    
            //loop all files
            if (req.files.recipes.name) {
                recipe = req.files.recipes;
                processRecipe(recipe, data);
            }

            for ( i=0; i < req.files.recipes.length; i++) {
                let recipe = req.files.recipes[i];
                
                processRecipe(recipe, data);
            };
    
            //return response
            res.send({
                status: true,
                message: 'Files are uploaded',
                data: data
            });
        }
    } catch (err) {
        res.status(500).send(err);
    }
};