const inquirer = require('inquirer');
const chalk = require('chalk');

module.exports = context => {
  context.getInfo = async () => {
    let options = {
      service: 'Elemental',
      providerPlugin: 'awscloudformation'
    };
    await getLiveStreamInfo(context, options)
  }
}

async function getLiveStreamInfo(context, options){
  const { amplify } = context;
  let project;
  const amplifyMeta = context.amplify.getProjectMeta();
  const chooseProject = [
    {
      type: 'list',
      name: 'resourceName',
      message: 'Choose what project you want to get info for?',
      choices: Object.keys(amplifyMeta.Elemental),
      default: Object.keys(amplifyMeta.Elemental)[0],
    }
  ];

  if(!amplify.Elemental && Object.keys(amplifyMeta.Elemental).length != 0){
    project = await inquirer.prompt(chooseProject);
    await prettifyOutput(amplifyMeta.Elemental[project.resourceName].output);
  } else {
    console.log(chalk.bold("You have no Elemental projects."));
    return;
  }
}

async function prettifyOutput(output){
  console.log(chalk.bold("MediaLive"));
  console.log(chalk`MediaLive Primary Ingest Url: {blue.underline ${output.oMediaLivePrimaryIngestUrl}}`);
  console.log(chalk`MediaLive Backup Ingest Url: {blue.underline ${output.oMediaLiveBackupIngestUrl}}`);

  console.log(chalk.bold("\nMediaPackage"));
  if (output.oPrimaryHlsEgress){
    console.log(chalk`MediaPackage HLS Egress Url: {blue.underline ${output.oPrimaryHlsEgress}}`);
  }
  if (output.oPrimaryDashEgress){
    console.log(chalk`MediaPackage Dash Egress Url: {blue.underline ${output.oPrimaryDashEgress}}`);
  }
  if (output.oPrimaryMssEgress){
    console.log(chalk`MediaPackage MSS Egress Url: {blue.underline \e]8;;${output.oPrimaryMssEgress}}e]8;;\a`);
  }
  if (output.oPrimaryCmafEgress){
    console.log(chalk`MediaPackage CMAF Egress Url: {blue.underline ${output.oPrimaryCmafEgress}}`);
  }

  if(output.oMediaStoreContainerName){
    console.log(chalk.bold("\nMediaStore"));
    console.log(chalk`MediaStore Output Url: {blue.underline ${output.oBackupMediaStoreEgressUrl}}`);
  }

  
}
