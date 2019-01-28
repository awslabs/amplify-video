const featureName = 'video';
const chalk = require('chalk');

module.exports = {
  name: featureName,
  run: async (context) => {
    if (/^win/.test(process.platform)) {
      console.log('test');
      try {
        const { run } = require(`./${featureName}/${context.parameters.first}`);
        return run(context);
      } catch (e) {
        context.print.error('Command not found');
      }
    }
    const header = `amplify ${featureName} <subcommand>`;

    console.log(context.parameters.first, 'blah blah blah');
    const commands = [
      {
        name: 'add',
        description: `Takes you through a CLI flow to add a ${featureName} resource to your local backend`,
      },
      {
        name: 'update',
        description: `Takes you through a CLI flow to update a ${featureName} resource`,
      },
      {
        name: 'push',
        description: `Provisions ${featureName} cloud resources and it's dependencies with the latest local developments`,
      },
      {
        name: 'get-info',
        description: `Gets info for ${featureName} resource from the CloudFormation template`,
      },
      {
        name: 'start',
        description: `Starts your ${featureName} stream from an idle state`,
      },
      {
        name: 'stop',
        description: `Puts your ${featureName} stream into an idle state`,
      },
      {
        name: 'remove',
        description: `Removes ${featureName} resource from your local backend and will remove them on amplify push`,
      },
      {
        name: 'setup-obs',
        description: `Sets up OBS with your stream settings.`,
      },
    ];

    context.amplify.showHelp(header, commands);

    context.print.info('');
  },
};
