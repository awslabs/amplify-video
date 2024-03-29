const inquirer = require('inquirer');

const subcommand = 'stop';
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
    const filteredProjects = Object.keys(amplifyMeta[category]).filter((project) => amplifyMeta[category][project].serviceType === 'livestream');
    if (filteredProjects.length === 0) {
      context.print.error('You have no livestreaming projects.');
      return;
    }

    const chooseProject = [
      {
        type: 'list',
        name: 'resourceName',
        message: 'Choose what project you want to stop?',
        choices: filteredProjects,
        default: filteredProjects[0],
      },
    ];

    const props = await inquirer.prompt(chooseProject);

    const options = amplifyMeta.video[props.resourceName];

    const providerController = require(`../../provider-utils/${options.providerPlugin}/index`);
    if (!providerController) {
      context.print.error('Provider not configured for this category');
      return;
    }

    /* eslint-disable */
    return providerController.livestreamStartStop(context, options.serviceType, options, props.resourceName, false);
    /* eslint-enable */
  },
};
