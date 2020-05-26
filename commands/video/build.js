const inquirer = require('inquirer');
const fs = require('fs');

const subcommand = 'build';
const category = 'video';

module.exports = {
  name: subcommand,
  run: async (context) => {
    const { amplify } = context;
    const targetDir = amplify.pathManager.getBackendDirPath();
    const amplifyMeta = amplify.getProjectMeta();

    if (!(category in amplifyMeta) || Object.keys(amplifyMeta[category]).length === 0) {
      context.print.error(`You have no ${category} projects.`);
      return;
    }

    const chooseProject = [
      {
        type: 'list',
        name: 'resourceName',
        message: 'Choose what project you want to build?',
        choices: Object.keys(amplifyMeta[category]),
        default: Object.keys(amplifyMeta[category])[0],
      },
    ];
    const shared = await inquirer.prompt(chooseProject);

    const options = amplifyMeta.video[shared.resourceName];

    const { buildTemplates } = require(`../../provider-utils/${options.providerPlugin}/utils/video-staging`);
    if (!buildTemplates) {
      context.print.error('No builder is configured for this provider');
      return;
    }

    const props = JSON.parse(fs.readFileSync(`${targetDir}/video/${shared.resourceName}/props.json`));

    return buildTemplates(context, props);
  },

};
