const inquirer = require('inquirer');

const subcommand = 'setup-player';
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

    /*     const filteredProjects = Object.keys(amplifyMeta[category]).filter(project => (
      amplifyMeta[category][project].serviceType === 'video-on-demand' || amplifyMeta[category][project].serviceType === 'ivs'));
    if (filteredProjects.length === 0) {
      context.print.error('You have no livestreaming projects.');
      return;
    } */

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

    return playerController.setupPlayer(context, props.resourceName);
  },
};
