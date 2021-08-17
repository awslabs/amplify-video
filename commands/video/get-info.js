const inquirer = require('inquirer');

const subcommand = 'get-info';
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
    
    let props;
    if (context.parameters.options.default) {
      props = {resourceName:chooseProject[0].default};
    } else{
      props = await inquirer.prompt(chooseProject);
    }

    const options = amplifyMeta.video[props.resourceName];

    const infoController = require(`../../provider-utils/${options.providerPlugin}/utils/video-getinfo`);
    if (!infoController) {
      context.print.error('Info controller not configured for this category');
      return;
    }

    return infoController.getVideoInfo(context, props.resourceName);
  },
};
