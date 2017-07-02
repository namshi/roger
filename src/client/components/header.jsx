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
          <div className="collapse navbar-collapse">
              <ul className="nav navbar-nav navbar-right">
                  <li><a href="/auth/github">Login</a></li>
              </ul>
          </div>
        </div>
      </nav>
    )
  }
}

export default Header;
