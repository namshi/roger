'use strict';
import axios from 'axios';
import alt from '../lib/alt';
import Utils from '../utils/utils';

class Actions {
  startBuild(projectName, branch) {
    let buildUrl = `/api/build?repo=${projectName}`;

    if(branch) {
      branch = branch === 'latest' ? 'master' : branch;
      buildUrl += `&branch=${branch}`;
    }

    axios.get(buildUrl).then(res=> {
      alert(res.data.message);
      this.actions.updateBuildInProgress(projectName);
    });
  }

  updateBuildInProgress(projectName) {
    this.dispatch(projectName);
  }

  loadProjects() {
    return axios.get('/api/projects?limit=10')
      .then(res=> {
        return res.data.projects || [];
      })
      .catch(err=> {
        console.log('Error loading projects', err);
      });
  }

  loadBuilds() {
    return axios.get('/api/builds?limit=100')
      .then(res=> {
        return res.data.builds || [];
      })
      .catch(err=> {
        console.log('Error loading builds', err);
      });
  }

  loadData() {
    axios.all([this.actions.loadProjects(), this.actions.loadBuilds()]).then((data)=> {
      let builds = data[1];
      let projects = Utils.getUniqProjects(data[0]);
      this.actions.updateData({
        'projects': projects,
        'builds': builds
      });
    });
  }

  updateData(data) {
    this.dispatch(data);
  }
}
export default alt.createActions(Actions);
