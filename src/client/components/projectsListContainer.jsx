'use strict';

import React from 'react';
import Project from '../components/project';
import Utils from '../utils/utils'
import _ from 'lodash';

class ProjectsListContainer extends React.Component {
  constructor(...props) {
    super(...props);
    this.state = {
      searchText: ''
    };
    this.filterProjects = this.filterProjects.bind(this);
  }

  filterProjects(e) {
    this.setState({
      searchText: e.target.value
    });
  }

  render(){

    let isSelectedProject = (project)=> {
      let params = this.props.params;
      return params.project === Utils.getProjectShortName(project.name);
    };

    return (
      <div id="sideBar" className={this.props.className}>
        <h4>Projects</h4>
        <div className="search-projects">
          <input type="text" placeholder="Filter projects" className="input-md full-width form-control" onChange={this.filterProjects}/>
          </div>
          <div className="projects-list list-group">
            {
              _.filter(this.props.projects,(p)=>{
                let name = Utils.getProjectShortName(p.alias);
                return !! name.match(this.state.searchText, 'ig');
              }).map((project) =>{
                return <Project data={project} key={project.latest_build.id} selected={isSelectedProject(project)}/>
              })
            }
          </div>
        </div>
    );
  }
}

export default ProjectsListContainer;