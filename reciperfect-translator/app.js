// AWS SDK v3 clients
const { TranslateClient, TranslateTextCommand } = require("@aws-sdk/client-translate");
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");
const { TextractClient, AnalyzeDocumentCommand } = require("@aws-sdk/client-textract");

const axios = require("axios");
const path = require("path"); // Node.js core path module
const fs = require("fs");
const { Readable } = require('stream'); // Node.js core stream module
const chokidar = require('chokidar');

// Load environment variables from .env file
require("dotenv").config({ path: path.resolve(__dirname, "config.env") });

// --- Configuration Loading & Validation ---
const UPLOAD_DIR = process.env.UPLOAD_DIR;
const ADD_URL = process.env.ADD_URL;
const FS_URL = process.env.FS_URL;
const AWS_REGION = process.env.AWS_REGION || 'us-west-2';

const TRANSLATE_SOURCE_LANG_CODE = process.env.TRANSLATE_SOURCE_LANG_CODE || 'auto';
const TRANSLATE_TARGET_LANG_CODE = process.env.TRANSLATE_TARGET_LANG_CODE || 'es-ES';
const POLLY_VOICE_ID = process.env.POLLY_VOICE_ID || 'Camila';
// POLLY_LANGUAGE_CODE will be derived from TRANSLATE_TARGET_LANG_CODE

const rawFilterKeywords = process.env.TEXTRACT_FILTER_KEYWORDS || ":,.com,takeout,General,Recipe,U of M,U Of M,Ingredients,Recipes On,Steps,Item Locations,Ingredient,Qty,Save";
const TEXTRACT_FILTER_KEYWORDS = rawFilterKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0);

const essentialEnvVars = { UPLOAD_DIR, ADD_URL, FS_URL, AWS_REGION };
for (const [varName, value] of Object.entries(essentialEnvVars)) {
    if (!value) {
        console.error(`FATAL ERROR: Environment variable ${varName} is not set. Please check your config.env file or environment settings.`);
        process.exit(1);
    }
}
// --- End Configuration Loading & Validation ---


// Initialize AWS Clients with region
// Credentials will be handled by the SDK's default credential chain (environment, shared credentials file, IAM roles)
const translateClient = new TranslateClient({ region: AWS_REGION });
const pollyClient = new PollyClient({ region: AWS_REGION });
const textractClient = new TextractClient({ region: AWS_REGION });


async function translateAndStoreRecipe(data, filePath) {
    try {
        var translateParams = {
            SourceLanguageCode: TRANSLATE_SOURCE_LANG_CODE,
            TargetLanguageCode: TRANSLATE_TARGET_LANG_CODE,
            Text: ''
        };

        let pollySynthesisParams = {
            'Text': '',
            'OutputFormat': 'mp3',
            'VoiceId': POLLY_VOICE_ID,
            'LanguageCode': TRANSLATE_TARGET_LANG_CODE
        };

        let convertedJSON = JSON.parse(JSON.stringify(data));

        convertedJSON = convertedJSON
            .filter(item => item.BlockType == "LINE")
            .filter(item => !TEXTRACT_FILTER_KEYWORDS.some(keyword => item.Text.includes(keyword)));

        let extension = path.extname(filePath);
        let filename = path.basename(filePath, extension);
        let fullfile = filename + extension;

        let processedDataForPost = [];
        const mp3FilePath = path.join(UPLOAD_DIR, filename + '.mp3');
        const mp3FileStream = fs.createWriteStream(mp3FilePath);

        // Promise to handle the end of the stream writing
        const streamFinished = new Promise((resolve, reject) => {
            mp3FileStream.on('finish', resolve);
            mp3FileStream.on('error', reject);
        });

        for (const item of convertedJSON) {
            try {
                translateParams.Text = item.Text;
                const translateCommand = new TranslateTextCommand(translateParams);
                const translateResult = await translateClient.send(translateCommand);
                console.log(item.Text + "\t\t\t" + translateResult.TranslatedText + "\n");

                item.Translations = [];
                const translation = { TargetLanguageCode: translateParams.TargetLanguageCode, TranslatedText: translateResult.TranslatedText };
                item.Translations.push(translation);

                pollySynthesisParams.Text = translateResult.TranslatedText;
                const synthSpeechCommand = new SynthesizeSpeechCommand(pollySynthesisParams);
                const speechData = await pollyClient.send(synthSpeechCommand);
                
                if (speechData.AudioStream instanceof Readable) {
                    console.log(`Streaming audio for line: "${item.Text}"`);
                    // Pipe the audio stream from Polly into the main MP3 file stream
                    // This await ensures that the current line's audio is fully written before proceeding to the next Polly request,
                    // though for mp3 concatenation, simple piping without this specific await on pipe is also common.
                    // However, to ensure ordered writing and catch errors per segment:
                    await new Promise((resolvePipe, rejectPipe) => {
                        speechData.AudioStream.pipe(mp3FileStream, { end: false }); // important: end: false
                        speechData.AudioStream.on('end', resolvePipe);
                        speechData.AudioStream.on('error', rejectPipe);
                    });
                }
                processedDataForPost.push(item);
            } catch (lineError) {
                console.error(`Error processing line "${item.Text}" for audio/translation:`, lineError.message || lineError);
                item.Error = `Failed to process line for audio/translation: ${lineError.message || lineError}`;
                processedDataForPost.push(item);
            }
        }

        // After all lines are processed, end the main MP3 writable stream
        mp3FileStream.end();

        try {
            await streamFinished; // Wait for the stream to finish writing and close
            console.log(`MP3 file ${mp3FilePath} has been successfully written.`);
        } catch (mp3StreamError) {
            console.error(`Error writing MP3 file ${mp3FilePath}:`, mp3StreamError);
            // Decide how to handle this: maybe the POST request should not include the MP3 URL,
            // or it should be marked as failed. For now, we'll log and continue.
            // The file might be partially written or corrupted.
        }

        let convertJSONString = JSON.stringify(processedDataForPost);

        let url = FS_URL + fullfile; // Use FS_URL from env
        let mp3 = FS_URL + filename + ".mp3";
        let postData = { url: url, mp3: mp3, records: JSON.parse(convertJSONString) };

        try {
            const res = await axios.post(
                ADD_URL, // Use ADD_URL from env
                postData,
                { headers: { "Content-Type": "application/json" } }
            );
            console.log(`Successfully POSTed data for ${filePath}: ` + res.data);
        } catch (axiosError) {
            console.error(`Error POSTing data for ${filePath}:`, axiosError.message || axiosError);
            // Decide if this error should be re-thrown to be caught by processFile's catch block
            throw axiosError; // Re-throw to indicate overall failure for this file's DB storage
        }

    } catch (error) {
        console.error(`Critical error in translateAndStoreRecipe for ${filePath}:`, error.message || error);
        // This catch block handles errors from the main logic of translateAndStoreRecipe,
        // not from individual line processing if those are caught and handled within the loop.
        throw error; // Re-throw to be caught by processFile
    }
}


async function processFile(filePath) {
    try {
        console.log(`Processing file: ${filePath}`);
        const fileBuffer = fs.readFileSync(filePath);

        const analyzeDocParams = {
            Document: {
                Bytes: fileBuffer,
            },
            FeatureTypes: ["FORMS", "TABLES"]
        };

        const command = new AnalyzeDocumentCommand(analyzeDocParams);
        const data = await textractClient.send(command);

        if (data && data.Blocks) {
            await translateAndStoreRecipe(data.Blocks, filePath); // Pass filePath
        } else {
            console.error("Textract did not return Blocks for file:", filePath);
            // TODO: Handle this case, e.g., move file to an error directory
        }

    } catch (error) {
        console.error(`Error processing file ${filePath} with Textract:`, error);
        // TODO: Implement more robust error handling (e.g., move file to error dir)
    }
}

// Check for UPLOAD_DIR existence (basic check)
if (!process.env.UPLOAD_DIR || !fs.existsSync(process.env.UPLOAD_DIR)) {
    console.error(`Error: UPLOAD_DIR environment variable is not set or directory does not exist: ${process.env.UPLOAD_DIR}`);
    process.exit(1);
}
console.log('Listening for files on ' + process.env.UPLOAD_DIR);

const watcher = chokidar.watch(process.env.UPLOAD_DIR, { persistent: true, ignored: '*.mp3' }); // Ignore mp3 files

watcher.on('add', filePath => { // Renamed path to filePath
    console.log(`File ${filePath} has been added`);
    processFile(filePath); // Call the async function
});

// TODO: Add more robust error handling for the watcher itself
watcher.on('error', error => console.error(`Watcher error: ${error}`));

