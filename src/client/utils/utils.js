'use strict';
import _ from 'lodash';

class Utils {
  static getProjectShortName(projectName = '') {
    let parts = projectName.split('__');
    return parts[1] || parts[0];
  }

  static getProjectUrl(projectName = '') {
    let parts = projectName.split('__');
    return parts[0];
  }

  static getUniqProjects(projects) {
    return _.chain(projects)
          .sortByOrder( p => {
            return p.latest_build.updated_by;
          }, 'desc')
          .uniq(project => {
            return this.getProjectShortName(project.name);
          }).value()
  }

  static filterBuildsByProject(builds, projectName){
    return _.filter(builds, build => {
      return this.getProjectShortName(build.project) === this.getProjectShortName(projectName);
    })
  }

  static getBuildStatusClassName(status) {
    let classNamesMap = {
      'passed': 'label-success',
      'failed': 'label-danger',
      'started': 'label-warning'
    };

    return classNamesMap[status] || '';
  }
}

export default Utils;