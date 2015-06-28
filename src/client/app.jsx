import React from 'react';
import Header from './components/header';


export class App extends React.Component {
  render() {
    return (
      <Header appName={'Roger'}></Header>
    );
  }
}

React.render(<App/>, document.getElementById("rogerApp"));