const inquirer = require('inquirer');
const subcommand = 'update';
const category = 'video';

module.exports = {
  name: subcommand,
  run: async (context) => {
    const {amplify} = context;
    const amplifyMeta = amplify.getProjectMeta();

    const chooseProject = [
      {
        type: 'list',
        name: 'resourceName',
        message: 'Choose what project you want to update?',
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

    return providerController.updateResource(context, options.serviceType, options, props.resourceName);
  },
  
};
