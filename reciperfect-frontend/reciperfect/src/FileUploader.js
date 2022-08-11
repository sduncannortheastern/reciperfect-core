import React, {Component} from 'react';
import ReactDOM from 'react-dom/client';
import logo from './logo.svg';
import axios from 'axios';
import './App.css';

class FileUploader extends Component {
  
  file_upload_url = "http://localhost:3300/upload-recipes";

  state = {
    selectedFile: null
  };

  onFileUpload = () => {
    console.log('onfileupload: ' + this.state.selectedFile);
    if (this.state.selectedFile) {
      let formData = new FormData();
      formData.append('recipes', this.state.selectedFile);
      axios.post(
        this.file_upload_url,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          }
        }
      )
      .then(res => {
        console.log('success: ' + res.data);
      })
      .catch(err => {
        console.log('error: ' + err);
      } )
    }
  };

  fileData = () => {
    if (this.state.selectedFile) {
      return (
        <div>
          <h2>File Details: </h2>
          <p>File Name: {this.state.selectedFile.name}</p>
          <p>File Type: {this.state.selectedFile.type}</p>
          <p>
            Last Modified: {" "}
            {this.state.selectedFile.lastModifiedDate.toDateString()}
          </p>
        </div>
      );
    } else {
      return (
        <div>
          <br/>
          <h4>Choose before pressing the Upload button</h4>
        </div>
      );
    }
  };

  render() {
    return (
      <div className="App">
        <div>
          <input type="file"  onChange={ (e) => this.setState({selectedFile: e.target.files[0]}) } />
          <button onClick={this.onFileUpload}>
            Upload!
          </button>
        </div>
        {this.fileData()}
      </div>
    );
  };
}

export default FileUploader;
