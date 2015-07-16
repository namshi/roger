import React from 'react';
import _ from 'lodash';
import Router from 'react-router';
import {Route, RouteHandler} from 'react-router';
import Header from './components/header';
import ProjectsListContainer from './components/projectsListContainer';
import ProjectDetails from './components/projectDetails';
import store from './stores/store';
import actions from './actions/actions';
import Utils from './utils/utils';

export class ProjectDetailsView extends React.Component {
  constructor(...props) {
    super(...props);
  }

  render() {
    let getProjectDetails = () => {
      return _.find(this.props.projects, (project)=>{
          return Utils.getProjectShortName(project.name) === this.props.params.project;
        }) || {}
    };
    let buildId = this.props.params.buildId;

    return <ProjectDetails project={getProjectDetails()} builds={this.props.builds} buildId={buildId}></ProjectDetails>;
  }
}

export class App extends React.Component {
  constructor(...props) {
    super(...props);
    this.state = store.getState();
    this.onUpdate = this.onUpdate.bind(this);
  }

  componentWillMount() {
    store.listen(this.onUpdate);
  }

  componentWillUnmount() {
    store.unlisten(this.onUpdate);
  }

  componentDidMount() {
    let socket = io.connect();
    actions.loadData();
    socket.on('fetch-data', function () {
      actions.loadData();
    });
  }

  componentDidUpdate() {
    let projects = this.state.projects;
    if(projects.length>0 && !this.props.params.project) {
      let projectName = Utils.getProjectShortName(projects[0].name);
      let buildId = projects[0].latest_build.id;
      this.context.router.transitionTo(`/projects/${projectName}/${buildId}`);
    }
  }

  onUpdate(state) {
    this.setState(state);
  }

  render() {
    return (
      <div>
        <Header appName={'Roger'}></Header>
        <div className="content-wrapper">
          <div className="container-fluid">
            <div className="row">
              <ProjectsListContainer className="col-xs-3 col-md-3" projects={this.state.projects} {...this.props}></ProjectsListContainer>
              <div  id="mainContent" className="col-xs-9 col-md-9">
                <RouteHandler {...this.state}></RouteHandler>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

App.contextTypes = {
  router: React.PropTypes.func.isRequired
};

let routes = (
  <Route path="/" handler={App} ignoreScrollBehavior>
    <Route name="project" path="projects/:project" handler={ProjectDetailsView} />
    <Route name="project-build" path="projects/:project/:buildId" handler={ProjectDetailsView} />
  </Route>
);

Router.run(routes, function (Handler, state) {
  React.render(<Handler {...state}/>, document.getElementById('rogerApp'));
});
