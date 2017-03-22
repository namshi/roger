'use strict';

import alt from '../lib/alt';
import actions from '../actions/actions';
import _ from 'lodash';
import Utility from '../utils/utils';

class Store {
  constructor() {
    this.projects = [];
    this.builds = [];
    this.bindAction(actions.updateData, this.updateData);
    this.bindAction(actions.updateBuildInProgress, this.updateBuildInProgress);
  }

  updateData(data) {
    this.projects = data.projects;
    this.builds = data.builds;
  }

  updateBuildInProgress(projectName) {
    let project = _.find(this.projects, function (project) {
      return Utility.getProjectUrl(project.name) === projectName;
    });

    project && (project.buildInProgress = true);
  }

}

export default alt.createStore(Store);
