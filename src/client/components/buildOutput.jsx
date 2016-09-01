'use strict';

import React from 'react';
import ss from 'socket.io-stream';

class BuildOutput extends React.Component {
  constructor(...props) {
    super(...props);
    this.state = {
      output: 'Loading ...'
    };
    this.stream = null;
  }

  componentDidMount() {
    this.fetchBuildOutput(this.props.buildId);
  }

  componentWillReceiveProps(props) {
    this.setState({
      output: 'Loading ...'
    });

    this.fetchBuildOutput(props.buildId);
  }

  fetchBuildOutput(buildId) {
    let socket = io.connect();

    if(this.stream) {
      this.stream.destroy();
    }

    let stream = this.stream = ss.createStream();

    ss(socket).emit('get-build-log', stream, {buildId: buildId});
    let data = '';

    stream.on('data', (chunk)=> {
      data += chunk.toString();
      this.updateBuildOutput(data);
    });

    stream.on('end', function () {
      console.log('ended');
    });
  }

  updateBuildOutput(data) {
    this.setState({
      output: data
    });
    let elem = this.refs.output.getDOMNode();
    elem.scrollTop = elem.scrollHeight;
  }

  render() {
    return <div>
      <div className="build-output__header">
        <span className="title">Build Id</span> : <a href="{`/api/builds/${this.props.buildId}/log`}" target="_blank">{this.props.buildId}</a> <br/><br/>
      </div>
      <pre className="build-output__log" ref="output">{this.state.output}</pre>
    </div>;
  }
}

export default BuildOutput; 
