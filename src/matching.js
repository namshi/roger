const _ = require('lodash');
const git = require('./git');

const matching = {};

/**
 * Check branch name against settings match rules
 * @param  {object} settings - The global settings key from build.yml
 * @param  {string} name     - The name of the branch to be built
 * @param  {string} path     - The path to the Git repository
 * @return {boolean}         - The result of the check, true if match is found
 */
matching.checkNameRules = async function(settings, name, path) {
  // Default settings match all branches
  if (!settings || !settings.matching) {
    return true;
  }

  const { branches, patterns, tags } = settings.matching;

  // Allow exact branch names
  if (branches && branches.includes(name)) {
    return true;
  }

  // Allow tags when enabled
  if (tags === true && await git.getRefType(path, name) === 'tag') {
    return true;
  }

  // Allow any name that matches a regex pattern
  if (patterns && _.some(patterns, function(pattern) {
      const regex = new RegExp(pattern);
      return regex.test(name);
    })) {
    return true;
  }

  // Disallow if no sub-keys are defined
  return false;
}

module.exports = matching;
