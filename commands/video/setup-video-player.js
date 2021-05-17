const inquirer = require('inquirer');

const subcommand = 'setup-video-player';
const category = 'video';

module.exports = {
  name: subcommand,
  run: async (context) => {
    const { amplify } = context;
    const amplifyMeta = amplify.getProjectMeta();

    if (!(category in amplifyMeta) || Object.keys(amplifyMeta[category]).length === 0) {
      context.print.error(`You have no ${category} projects.`);
      return;
    }

    const filteredProjects = Object.keys(amplifyMeta[category]);

    const chooseProject = [
      {
        type: 'list',
        name: 'resourceName',
        message: 'Choose what project you want to set up a player for?',
        choices: filteredProjects,
        default: filteredProjects[0],
      },
    ];
    const props = await inquirer.prompt(chooseProject);

    const options = amplifyMeta.video[props.resourceName];

    const playerController = require(`../../provider-utils/${options.providerPlugin}/utils/video-player.js`);
    if (!playerController) {
      context.print.error('Player controller not configured for this project.');
      return;
    }

    return playerController.setupVideoPlayer(context, props.resourceName);
  },
};
