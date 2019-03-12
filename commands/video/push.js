const inquirer = require('inquirer');

module.exports = {
  name: 'push',
  run: async (context) => {
    const { amplify } = context;

    const chooseProject = [
      {
        type: 'list',
        name: 'resourceName',
        message: 'Choose what project you want to update?',
        choices: Object.keys(context.amplify.getProjectMeta().video),
        default: Object.keys(context.amplify.getProjectMeta().video)[0],
      },
    ];

    const answer = await inquirer.prompt(chooseProject);

    return amplify.pushResources(context, 'video', answer.resourceName)
      .catch((err) => {
        context.print.info(err.stack);
        context.print.error('There was an error pushing the video resource');
      });
  },
};
