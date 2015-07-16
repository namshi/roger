'use strict';

import React from 'react';

class Header extends React.Component {
  render() {
    return (
      <nav className="navbar navbar-inverse navbar-static-top">
        <div className="container-fluid">
          <div className="navbar-header">
            <a className="navbar-brand" href="#">{this.props.appName}</a>
          </div>
        </div>
      </nav>
    )
  }
}

export default Header; 