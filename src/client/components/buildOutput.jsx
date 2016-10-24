'use strict';

import React from 'react';

class BuildOutput extends React.Component {
  constructor(...props) {
    super(...props);
    this.state = { autoUpdate: true };
    this._numberOfTries = 0;
    this._lastScrollHeight = 0;
    this.stopTimer = this.stopTimer.bind(this);
  }

  componentDidMount() {
    this.updateBuildOutput();
  }

  componentWillReceiveProps(props) {
    this.updateBuildOutput();
  }

  getBuildOutputWindow(){
    let buildOutputFrame = this.refs.buildOutputFrame.getDOMNode();
    return buildOutputFrame.contentWindow;
  }

  scrollLogView(){
    try{
      let _win = this.getBuildOutputWindow();
      let scrollHeight = _win.document.body.scrollHeight;

      if(scrollHeight === this._lastScrollHeight ){
        this._numberOfTries++;
      } else {
        this._numberOfTries = 0;
        this._lastScrollHeight = scrollHeight;
      }

      if( this._numberOfTries > 100 && this.props.buildStatus !== 'started' ){
        this.stopTimer();
        return;
      }

      if(this.state.autoUpdate){
        _win.scrollTo(0, scrollHeight);
      }
    } catch(e){}
  }

  updateBuildOutput(){
    this.stopTimer();
    this._numberOfTries = 0;

    let runTimer = () => {
      this.raf = requestAnimationFrame(this.scrollLogView.bind(this));
      this.tmr = setTimeout( runTimer, 1);
    };

    runTimer();
  }

  stopTimer(){
    clearTimeout(this.tmr);
    cancelAnimationFrame(this.raf);
  }

  toggleAutoUpdate(){
    this.setState({
      autoUpdate: !this.state.autoUpdate
    });

    if(this.state.autoUpdate){
      this.updateBuildOutput();
    }
  }

  render() {
    return <div>
      <div className="build-output__header">
        <span className="title">Build Id</span> : <a href={`/api/builds/${this.props.buildId}/log`} target="_blank">{this.props.buildId}</a>
        <span className="auto-update">
        Auto scroll: <input type="checkbox" checked={this.state.autoUpdate} onChange={this.toggleAutoUpdate.bind(this)} /> </span>
        <br/><br/>
      </div>
      <iframe ref="buildOutputFrame" className="build-output__log" src={`/api/builds/${this.props.buildId}/log`} />
    </div>;
  }
}

export default BuildOutput;
