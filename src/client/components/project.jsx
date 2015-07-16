'use strict';

import React from 'react';
import moment from 'moment';
import {Link} from 'react-router';
import Utils from '../utils/utils'

class Project extends React.Component {

  render() {
    let data = this.props.data;
    let build = data.latest_build;

    let getStatusClassName = function (status) {
      let classNamesMap = {
        'started': 'project__build--started',
        'passed': 'project__build--passed',
        'failed': 'project__build--failed'
      };

      return classNamesMap[status] || '';
    };

    let projectName = Utils.getProjectShortName(data.name);
    let activeClass = this.props.selected ? 'active' : '';

    return (
      <div className={`project project__build ${getStatusClassName(build.status)}`}>
        <Link to={`/projects/${projectName}/${build.id}`} className={`list-group-item ${activeClass}`}>
          <h4>
            {projectName} : <span className="badge pull-right">{build.branch}</span>
          </h4>
          <div><strong>tag:</strong> {build.tag}</div>
          <div><strong>created: </strong> {moment(build.created_at).fromNow()}</div>
          <div><strong>updated: </strong> {moment(build.updated_at).fromNow()}</div>
        </Link>
      </div>
    );
  }
}
export default Project; 