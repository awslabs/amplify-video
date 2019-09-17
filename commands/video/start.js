const inquirer = require('inquirer');
const subcommand = 'start';
const category = 'video';

module.exports = {
  name: subcommand,
  run: async (context) => {
    const {amplify} = context;
    const amplifyMeta = amplify.getProjectMeta();

    if (!(category in amplifyMeta) || Object.keys(amplifyMeta[category]).length === 0) {
      context.print.error(`You have no ${category} projects.`);
      return
    }

    const chooseProject = [
      {
        type: 'list',
        name: 'resourceName',
        message: 'Choose what project you want to start?',
        choices: Object.keys(amplifyMeta[category]),
        default: Object.keys(amplifyMeta[category])[0],
      },
    ];
    
    let props = await inquirer.prompt(chooseProject);

    let options = amplifyMeta.video[props.resourceName];

    const providerController =
          require(`../../provider-utils/${options.providerPlugin}/index`);
    if (!providerController) {
      context.print.error('Provider not configured for this category');
      return;
    }

    return providerController.livestreamStartStop(context, options.serviceType, options, props.resourceName, false);
  },
};
