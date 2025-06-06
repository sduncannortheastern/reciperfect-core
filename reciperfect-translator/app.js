const axios = require("axios");
const { TranslateClient, TranslateTextCommand } = require("@aws-sdk/client-translate");
const { PollyClient, SynthesizeSpeechCommand } = require("@aws-sdk/client-polly");
const { TextractClient, AnalyzeDocumentCommand } = require("@aws-sdk/client-textract"); // Added V3 Textract
const pathTools = require("path");
const fs = require("fs");
const { Readable } = require('stream'); // Only Readable is used from the stream module.
// const Speaker = require('speaker'); // Speaker was imported but not used.
const chokidar = require('chokidar');
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "config.env") });
const add_url = process.env.ADD_URL;

// AWS V3 clients will load credentials from environment variables by default.
// Region should be configured per client.
const awsRegion = process.env.AWS_REGION || 'us-west-2';

// Configuration for Translate and Polly from environment variables or defaults
const translateSourceLang = process.env.TRANSLATE_SOURCE_LANG || 'auto';
const translateTargetLang = process.env.TRANSLATE_TARGET_LANG || 'es-ES';
const pollyVoiceId = process.env.POLLY_VOICE_ID || 'Camila';
const pollyLanguageCode = process.env.POLLY_LANGUAGE_CODE || 'es-ES';
const pollyOutputFormat = process.env.POLLY_OUTPUT_FORMAT || 'mp3';

// Instantiate AWS V3 clients with region
const translateClient = new TranslateClient({ region: awsRegion });
const pollyClient = new PollyClient({ region: awsRegion });
const textractClient = new TextractClient({ region: awsRegion });

// Keywords for filtering text blocks
const TEXT_FILTER_KEYWORDS = [
    ":", ".com", "takeout", "General", "Recipe", "U of M", "U Of M",
    "Ingredients", "Recipes On", "Steps", "Item Locations", "Ingredient",
    "Qty", "Save"
];
// Create a single regex for keyword filtering (case-insensitive, whole word)
const keywordsRegex = new RegExp(`\\b(${TEXT_FILTER_KEYWORDS.join('|')})\\b`, 'i');

/**
 * Filters an array of Textract block objects.
 * @param {Array<Object>} textractBlocks - Raw blocks from Textract.
 * @param {RegExp} filterRegex - Regular expression for filtering out unwanted text.
 * @returns {Array<Object>} Filtered array of blocks.
 */
function filterTextBlocks(textractBlocks, filterRegex) {
    return textractBlocks.filter(item =>
        item.BlockType === "LINE" &&
        item.Text && // Ensure Text exists
        item.Text.length > 1 && // Basic filter for very short lines
        !filterRegex.test(item.Text) // Test against combined regex
    );
}

/**
 * Translates a single text segment using AWS Translate.
 * @param {string} text - The text to translate.
 * @param {string} sourceLang - Source language code.
 * @param {string} targetLang - Target language code.
 * @returns {Promise<string|null>} Translated text or null if translation fails.
 */
async function translateTextSegment(text, sourceLang, targetLang) {
    const translateParams = {
        SourceLanguageCode: sourceLang,
        TargetLanguageCode: targetLang,
        Text: text
    };
    const translateCommand = new TranslateTextCommand(translateParams);
    try {
        const translationResult = await translateClient.send(translateCommand);
        console.log(`SUCCESS: [AWS Translate] - Original: "${text}", Translated: "${translationResult.TranslatedText}"`);
        return translationResult.TranslatedText;
    } catch (translateError) {
        console.error(`ERROR: [AWS Translate] - Failed for text: "${text}" - Details: ${translateError.message}`, translateError);
        return null;
    }
}

/**
 * Synthesizes speech from text using AWS Polly.
 * @param {string} text - Text to synthesize.
 * @param {string} voiceId - Polly voice ID.
 * @param {string} languageCode - Polly language code.
 * @param {string} outputFormat - Output audio format.
 * @returns {Promise<Readable|null>} Readable stream of audio or null if synthesis fails.
 */
async function synthesizeSpeechSegment(text, voiceId, languageCode, outputFormat) {
    const pollyParams = {
        Text: text,
        OutputFormat: outputFormat,
        VoiceId: voiceId,
        LanguageCode: languageCode
    };
    const synthSpeechCommand = new SynthesizeSpeechCommand(pollyParams);
    try {
        const speechData = await pollyClient.send(synthSpeechCommand);
        console.log(`SUCCESS: [AWS Polly] - Synthesized speech for: "${text}"`);
        return speechData.AudioStream;
    } catch (pollyError) {
        console.error(`ERROR: [AWS Polly] - Failed for text: "${text}" - Details: ${pollyError.message}`, pollyError);
        return null;
    }
}

/**
 * Posts recipe data to a specified URL.
 * @param {string} postUrl - The URL to post data to.
 * @param {string} fileUrl - URL of the original recipe file.
 * @param {string} audioUrl - URL of the synthesized audio file.
 * @param {Array<Object>} recordsData - Array of processed recipe records.
 */
async function postRecipeData(postUrl, fileUrl, audioUrl, recordsData) {
    const payload = { url: fileUrl, mp3: audioUrl, records: recordsData };
    const payloadString = JSON.stringify(payload);
    try {
        const res = await axios.post(postUrl, payloadString, {
            headers: { "Content-Type": "application/json" }
        });
        console.log(`SUCCESS: [Post Data] - Successfully posted recipe data for ${fileUrl} - Response: ${res.data}`);
    } catch (err) {
        const errorMessage = err.response ? JSON.stringify(err.response.data) : err.message;
        console.error(`ERROR: [Post Data] - Failed to post recipe data for ${fileUrl} - Details: ${errorMessage}`, err);
    }
}

async function mainRecipeProcessingWorkflow(textractBlocks, filePath) {
    // Deep copy to avoid modifying original Textract blocks, then filter.
    let processedRecords = JSON.parse(JSON.stringify(textractBlocks));
    processedRecords = filterTextBlocks(processedRecords, keywordsRegex);

    const baseFilename = pathTools.basename(filePath, pathTools.extname(filePath));
    const outputMp3Path = path.join(process.env.UPLOAD_DIR, `${baseFilename}.mp3`);

    if (fs.existsSync(outputMp3Path)) {
        fs.unlinkSync(outputMp3Path); // Clear existing MP3 file
    }

    // Create a single writable stream for the entire MP3 file.
    // This allows sequential appending of audio data from Polly.
    // File Handling Strategy:
    // The MP3 is written directly to its final path in UPLOAD_DIR.
    // An existing file at that path is deleted before writing starts.
    // Trade-offs:
    // - Simplicity: Easier to implement than a temp file strategy.
    // - Risk: If the process crashes mid-stream, an incomplete MP3 might be left.
    // Future Improvement: For greater robustness against crashes, consider writing to a
    // temporary file (e.g., outputMp3Path + '.tmp') and then renaming it to outputMp3Path
    // only after all audio segments are successfully written and the stream is closed.
    // This ensures the final path only ever contains complete files.
    const fileWriteStream = fs.createWriteStream(outputMp3Path, { flags: 'a' });

    // Note on parallelization:
    // AWS Translate calls *could* be parallelized using Promise.all if desired,
    // as the order of translations can be mapped back to original records.
    // However, AWS Polly calls and subsequent audio stream appending *must* be sequential
    // to ensure the final MP3 is correctly ordered. Parallelizing Polly here would
    // lead to interleaved audio chunks from different text segments.
    // If parallel Polly processing is ever needed, a more complex strategy involving
    // saving individual segment MP3s and then concatenating them would be required.

    try {
        for (let i = 0; i < processedRecords.length; i++) {
            const record = processedRecords[i];
            if (!record.Text || record.Text.trim().length === 0) {
                continue; // Skip if no text
            }

            const translatedText = await translateTextSegment(record.Text, translateSourceLang, translateTargetLang);

            if (translatedText) {
                record.Translations = [{ TargetLanguageCode: translateTargetLang, TranslatedText: translatedText }];

                const audioStream = await synthesizeSpeechSegment(translatedText, pollyVoiceId, pollyLanguageCode, pollyOutputFormat);
                
                if (audioStream && audioStream instanceof Readable) {
                    try {
                        // Pipe the audio stream to the file, ensuring this segment is fully written
                        // before proceeding to the next to maintain order in the concatenated MP3.
                        await new Promise((resolve, reject) => {
                            audioStream.pipe(fileWriteStream, { end: false }); // end: false prevents closing the main write stream
                            audioStream.on('end', resolve);
                            audioStream.on('error', reject);
                        });
                        console.log(`SUCCESS: [File System] - Audio stream for "${translatedText}" appended to ${outputMp3Path}`);
                    } catch (streamError) {
                        console.error(`ERROR: [File System] - Failed to pipe audio for "${translatedText}" to ${outputMp3Path} - Details: ${streamError.message}`, streamError);
                    }
                } else if (audioStream === null) { // Explicitly null if Polly failed
                    // Error already logged by synthesizeSpeechSegment
                } else { // audioStream is not null but also not Readable
                     console.warn(`WARN: [AWS Polly] - AudioStream not readable for text: "${translatedText}"`);
                }
            } else {
                // Translation failed, mark record appropriately
                record.Translations = [{ TargetLanguageCode: translateTargetLang, TranslatedText: "Translation Error", Error: true, ErrorDetails: "Failed in translateTextSegment" }];
            }
        }
    } finally {
        // Ensure the main file write stream is closed once all processing is done or if an error occurs mid-loop.
        fileWriteStream.end(() => {
            console.log(`INFO: [File System] - MP3 file stream closed for ${outputMp3Path}`);
        });
    }

    const fullFileUrl = `${process.env.FS_URL}${pathTools.basename(filePath)}`;
    const mp3Url = `${process.env.FS_URL}${pathTools.basename(outputMp3Path)}`;
    
    // Post data even if some translations or synthesis failed; error flags are in records
    await postRecipeData(add_url, fullFileUrl, mp3Url, processedRecords);
}


async function processFile(filePath) {
    console.log(`Processing file: ${filePath}`);
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const analyzeDocParams = {
            Document: { Bytes: fileBuffer },
            FeatureTypes: ["FORMS", "TABLES"]
        };
        const analyzeDocCommand = new AnalyzeDocumentCommand(analyzeDocParams);
        const textractResponse = await textractClient.send(analyzeDocCommand);

        if (textractResponse.Blocks && textractResponse.Blocks.length > 0) {
            await mainRecipeProcessingWorkflow(textractResponse.Blocks, filePath);
        } else {
            console.warn(`WARN: [AWS Textract] - No Blocks returned for file: ${filePath}. Might be an empty or unsupported document.`);
        }
    } catch (error) {
        console.error(`ERROR: [AWS Textract] - Failed to analyze file ${filePath} - Details: ${error.message}`, error);
    }
}

console.log('Listening for files on ' + process.env.UPLOAD_DIR);

const watcher = chokidar.watch(process.env.UPLOAD_DIR, {
    persistent: true,
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    awaitWriteFinish: { // Wait for writes to complete
        stabilityThreshold: 2000,
        pollInterval: 100
    }
});

// Using a queue to process files one by one to avoid overwhelming services or local resources
let fileQueue = [];
let isProcessing = false;

async function processQueue() {
    if (isProcessing || fileQueue.length === 0) {
        return;
    }
    isProcessing = true;
    const filePathToProcess = fileQueue.shift();

    await processFile(filePathToProcess);

    isProcessing = false;
    processQueue(); // Process next file if any
}

watcher.on('add', filePath => {
    console.log(`File ${filePath} has been added to queue.`);
    if (!fileQueue.includes(filePath)) { // Avoid adding duplicates if events fire rapidly
        fileQueue.push(filePath);
        processQueue();
    }
});

