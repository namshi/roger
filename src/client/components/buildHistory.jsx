'use strict';

import React from 'react';
import Utils from '../utils/utils';
import {Link} from 'react-router';

class BuildHistory extends React.Component {
  render() {
    let getBuildStatusClassNames = (build)=> {
      return `label ${Utils.getBuildStatusClassName(build.status)}`
    };

    return (
      <div>
        <h4>Build History</h4>
        <div className="list-group">
          {this.props.builds.map((build, index)=> {
            let projectName = Utils.getProjectShortName(build.project);
            return (
              <Link to={`/projects/${projectName}/${build.id}`} className="list-group-item" key={index}>
                <div>
                  <strong>{build.branch}</strong>
                </div>
                <div>
                  <span className={getBuildStatusClassNames(build)}>{build.status}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  }
}

export default BuildHistory; 