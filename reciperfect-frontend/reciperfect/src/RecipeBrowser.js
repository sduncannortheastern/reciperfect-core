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

const useAudio = url => {
    const [audio] = useState(new Audio(url));
    const [playing, setPlaying] = useState(false);
  
    const toggle = () => setPlaying(!playing);
  
    useEffect(() => {
        playing ? audio.play() : audio.pause();
      },
      [playing]
    );
  
    useEffect(() => {
      audio.addEventListener('ended', () => setPlaying(false));
      return () => {
        audio.removeEventListener('ended', () => setPlaying(false));
      };
    }, []);
  
    return [playing, toggle];
  };
  
  const Player = ({ url }) => {
    const [playing, toggle] = useAudio(url);
  
    return (
      <div>
        <button onClick={toggle}>{playing ? "Pause" : "Play"}</button>
      </div>
    );
  };

function RecipeList(items) {
   
    return (
        <>

            <table width="100%">
                <tbody>
                    
                    {items.items.data.map(item => (
                        <>
                        <tr><th>Uploaded Recipe</th><th>Source Language: en</th><th>Target Language: es</th></tr>
                        <tr><th></th><th></th><th><Player url = {item.mp3}/></th></tr>
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