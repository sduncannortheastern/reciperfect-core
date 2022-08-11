import React, {Component} from 'react';
import ReactDOM from 'react-dom/client';
import logo from './logo.svg';
import axios from 'axios';
import './App.css';
import FileUploader from './FileUploader.js';
import RecipeBrowser from './RecipeBrowser.js';

class App extends Component {

  render() {
    return (
      <div className="App">
        <div>
          <h1>ReciPerfect</h1>
          <FileUploader/>
        </div>
        <div>
          <RecipeBrowser/>
        </div>
      </div>
    );
  };
}

export default App;
