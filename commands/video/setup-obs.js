const inquirer = require('inquirer');

const subcommand = 'setup-obs';
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

    const chooseProject = [
      {
        type: 'list',
        name: 'resourceName',
        message: 'Choose what project you want to get info for?',
        choices: Object.keys(amplifyMeta[category]),
        default: Object.keys(amplifyMeta[category])[0],
      },
    ];
    const props = await inquirer.prompt(chooseProject);

    const options = amplifyMeta.video[props.resourceName];

    const obsController = require(`../../provider-utils/${options.providerPlugin}/utils/livestream-obs`);
    if (!obsController && obsController.serviceType !== 'livestream') {
      context.print.error('OBS controller not configured for this project.');
      return;
    }

    return obsController.setupOBS(context, props.resourceName);
  },
};
