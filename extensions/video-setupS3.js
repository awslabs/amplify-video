const inquirer = require('inquirer');
const {copyFilesToS3} = require('./helpers/video-staging');

module.exports = (context) => {
    context.pushStaticFiles = async () => {
        await resetupLivestream(context);
    };
};

async function resetupLivestream(context) {
    const options = {
      service: 'video',
      serviceType: 'livestream',
      providerPlugin: 'awscloudformation',
    };
  
    const props = {};
  
    const chooseProject = [
      {
        type: 'list',
        name: 'resourceName',
        message: 'Choose what project you want to push the default templates to s3 again?',
        choices: Object.keys(context.amplify.getProjectMeta().video),
        default: Object.keys(context.amplify.getProjectMeta().video)[0],
      },
    ];
  
    props.shared = await inquirer.prompt(chooseProject);
  
    await copyFilesToS3(context, options, props);
  
    console.log(chalk.bold('Your S3 bucket has been setup.'));
  }