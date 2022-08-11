const AWS = require("aws-sdk");
const axios = require("axios");
const { TranslateClient, TranslateTextCommand } = require("@aws-sdk/client-translate");
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");
const pathTools = require("path");
const fs = require("fs");
const {Stream, Readable} = require('stream');
const Speaker = require('speaker');
const chokidar = require('chokidar');
const path = require("path");
const config = require("dotenv").config({ path: path.resolve(__dirname, "config.env") });
const add_url = process.env.ADD_URL;

AWS.config.update({
    region: 'us-west-2'
});

async function translateAndDisplayRecipe(data, path) {
    var translateParams = {
        SourceLanguageCode: 'auto',
        TargetLanguageCode: 'es',
        Text: ''
    }

    const client = new TranslateClient();
    
    // Create an Polly client
    const pollyClient = new PollyClient();

    let params = {
        'Text': '',
        'OutputFormat': 'pcm',
        'VoiceId': 'Camila',
        'LanguageCode': 'pt-BR'
    };

    var translateCommand = null;
    //synthSpeech = Promise.promisify(Polly.synthesizeSpeech);

    let speechData = null;
    let convertedJSON = JSON.parse(JSON.stringify(data));

    for (i=0; i<data.length; i++) {
        if (data[i].BlockType == "LINE") {
            
            translateParams.Text = (data[i].Text);
            translateCommand = new TranslateTextCommand(translateParams);
            esdata = await client.send(translateCommand);
            console.log(data[i].Text + "\t\t\t" + esdata.TranslatedText + "\n");
            
            convertedJSON[i].Translations = [];
            translation = {TargetLanguageCode: translateParams.TargetLanguageCode, TranslatedText: esdata.TranslatedText};
            convertedJSON[i].Translations.push(translation);

            

            //convertedJSON[i].TranslatedText = esdata.TranslatedText;
            params.Text = esdata.TranslatedText;
            /*let synthSpeechCommand = new SynthesizeSpeechCommand(params);
            speechData = await pollyClient.send(synthSpeechCommand);
            
             // Create the Speaker instance
            const player = new Speaker({
                channels: 1,
                bitDepth: 16,
                sampleRate: 16000
            });
            
            if (speechData.AudioStream instanceof Readable) {
                //var bufferStream = new Stream.PassThrough(speechData.AudioStream);
                //bufferStream.end(speechData.AudioStream);
                speechData.AudioStream.on('data', (chunk) => {
                    player.write(chunk);
                });
                speechData.AudioStream.on('end', () => {
                   player.end();
                });
                //await speechData.AudioStream.destroy();
            }
            */
        }
    }

    //Clean it up
    convertedJSON = convertedJSON
                    .filter(item => item.BlockType == "LINE")
                    .filter(item => item.Text.indexOf(":") == -1)
                    .filter(item => item.Text.indexOf(".com") == -1)
                    .filter(item => item.Text.indexOf("takeout") == -1)
                    .filter(item => item.Text.indexOf("General") == -1)
                    .filter(item => item.Text.indexOf("Recipe") == -1)
                    .filter(item => item.Text.indexOf("U of M") == -1)
                    .filter(item => item.Text.indexOf("U Of M") == -1)
                    .filter(item => item.Text.indexOf("Ingredients") == -1)
                    .filter(item => item.Text.indexOf("Recipes On") == -1)
                    .filter(item => item.Text.indexOf("Steps") == -1)
                    .filter(item => item.Text.indexOf("Item Locations") == -1)
                    .filter(item => item.Text.indexOf("Ingredient") == -1)
                    .filter(item => item.Text.indexOf("Qty") == -1)
                    .filter(item => item.Text.indexOf("Save") == -1)
                    ;
    let convertJSONString = JSON.stringify(convertedJSON);
    let extension = pathTools.extname(path);
    let filename = pathTools.basename(path, extension);
    let fullfile = filename + extension;
    let url = process.env.FS_URL + fullfile;
    let postData = {url: url, records: JSON.parse(convertJSONString)};
    let postDataString = JSON.stringify(postData);

    axios.post(
        add_url,
        postDataString,
        {
            headers: {
                "Content-Type": "application/json",
            }
        }
    )
    .then(res => {
        console.log('success: ' + res.data);
    })
    .catch(err => {
        console.log('error: ' + err);
    } );
}

const textract = new AWS.Textract();

//const awsTranslate = Promise.promisifyAll(translate);

function processFile(path) {
    var datafs = fs.readFileSync(path);

    var detectParamater = {
        Document: {
            Bytes: Buffer.from(datafs),
    
        },
        FeatureTypes: ["FORMS", "TABLES"]
    };
    
    request = textract.analyzeDocument(detectParamater, (err, data) => {
        if (err) {
            return err;
        } else {
            translateAndDisplayRecipe(data.Blocks, path);
        }
    });
    
};

console.log('Listening for files on ' + process.env.UPLOAD_DIR);

const watcher = chokidar.watch(process.env.UPLOAD_DIR, {persistent: true});

watcher.on('add', path => {processFile(path);});

