import React, {Component, useState, useEffect} from 'react';
import ReactDOM from 'react-dom/client';
import logo from './logo.svg';
import axios from 'axios';
import './App.css';

function TargetLanguageList(item) {
    //To-do: remove hardcoded language codes
    return (
       
            <table width="100%" vertical-align="top">
                <tbody vertical-align="top"> 
                    
                    {item.item.records.filter(phrase => phrase.BlockType === "LINE").filter(phrase => phrase.Text.length > 2).map(filteredPhrase => {
                        return (
                            <tr key={filteredPhrase._id}>
                                <td>{filteredPhrase.Translations[0].TranslatedText} </td>
                            </tr>
                    )})}
                    
                </tbody>
            </table>
    );
}
function SourceLanguageList(item) {
   
    return (
       
            <table width="100%" vertical-align="top">
                <tbody vertical-align="top"> 
                    
                    {item.item.records.filter(phrase => phrase.BlockType === "LINE").filter(phrase => phrase.Text.length > 2).map(filteredPhrase => {
                        return (
                            <tr key={filteredPhrase._id}>
                                <td>{filteredPhrase.Text} </td>
                            </tr>
                    )})}
                </tbody>
            </table>
    );
}

async function handleButtonClick(item) {
    alert('Steve was here');

    /*
     // Create an Polly client
     const pollyClient = new PollyClient();

     let params = {
         'Text': '',
         'OutputFormat': 'pcm',
         'VoiceId': 'Carmen',
         'LanguageCode': 'es-ES'
     };

     var speechData = null;

    item.item.records.filter(phrase => phrase.BlockType === "LINE").filter(phrase => phrase.Text.length > 2).map(filteredPhrase => async () => {
        params.Text = filteredPhrase.Translations[0].TranslatedText;
        let synthSpeechCommand = new SynthesizeSpeechCommand(params);
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
            
   });
   */
}

function PlayButton(items) {
   return (
     <button onClick={() => handleButtonClick(items.items.data)}>
        Play
     </button>
   );
} 

function RecipeList(items) {
   
    return (
        <>

            <table width="100%">
                <tbody>
                    
                    {items.items.data.map(item => (
                        <>
                        <tr><th>Uploaded Recipe</th><th>Source Language: en</th><th>Target Language: es</th></tr>
                        <tr><th></th><th></th><th><PlayButton/></th></tr>
                        <tr key={item._id} vertical-align="top">

                            <td width="30%"><img src={item.url} width="500" height="800"/></td>
                            <td width="30%" verical-align="top">
                                <SourceLanguageList item = {item}/>
                            </td>
                            <td width="30%">
                                <TargetLanguageList item = {item}/>
                            </td>
                        </tr>
                        </>
                    ))}
                </tbody>
            </table>

        </>
    );
}

function RecipeBrowser() {
    const [items, setItems] = useState(null);

    let recipe_find_url = "http://localhost:5000/record";

    useEffect(() => {
        const fetchRecords = async () => {
            try{
                let response = await axios.get(
                    "http://localhost:5000/record"
                );
                await setItems(response);
            } catch(e) {
                console.log(e);
            }
        }
        fetchRecords()
    }, []);

    return (
        <div>
            { items && <RecipeList items = {items}/>} 
        </div>
    );
}

export default RecipeBrowser;