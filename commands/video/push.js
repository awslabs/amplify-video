const inquirer = require('inquirer');
const subcommand = 'push';
const category = 'video';

module.exports = {
  name: subcommand,
  run: async (context) => {
    const { amplify } = context;

    const chooseProject = [
      {
        type: 'list',
        name: 'resourceName',
        message: 'Choose what project you want to update?',
        choices: Object.keys(context.amplify.getProjectMeta()[category]),
        default: Object.keys(context.amplify.getProjectMeta()[category])[0],
      },
    ];

    const answer = await inquirer.prompt(chooseProject);
    amplify.constructExeInfo(context);
    return amplify.pushResources(context, category, answer.resourceName)
      .catch((err) => {
        context.print.info(err.stack);
        context.print.error('There was an error pushing the video resource');
      });
  },
};
