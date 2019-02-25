const inquirer = require('inquirer');
const chalk = require('chalk');

module.exports = context => {
  context.getInfo = async () => {
    let options = {
      service: 'video',
      providerPlugin: 'awscloudformation'
    };
    await getLiveStreamInfo(context, options)
  }
}

async function getLiveStreamInfo(context, options){
  const { amplify } = context;
  let project;
  const amplifyMeta = context.amplify.getProjectMeta();
  if (!amplifyMeta.video){
    chalk.bold("You have no video projects.");
  }
  const chooseProject = [
    {
      type: 'list',
      name: 'resourceName',
      message: 'Choose what project you want to get info for?',
      choices: Object.keys(amplifyMeta.video),
      default: Object.keys(amplifyMeta.video)[0],
    }
  ];

  if(!amplify.video && Object.keys(amplifyMeta.video).length != 0){
    project = await inquirer.prompt(chooseProject);
    if (amplifyMeta.video[project.resourceName].output){
      await prettifyOutput(amplifyMeta.video[project.resourceName].output);
    } else {
      console.log(chalk`{bold You have not pushed ${project.resourceName} to the cloud yet.}`);
    }
  } else {
    console.log(chalk.bold("You have no video projects."));
    return;
  }
}

async function prettifyOutput(output){
  console.log(chalk.bold("MediaLive"));
  console.log(chalk`MediaLive Primary Ingest Url: {blue.underline ${output.oMediaLivePrimaryIngestUrl}}`);
  var primaryKey = output.oMediaLivePrimaryIngestUrl.split('/');
  console.log(chalk`MediaLive Primary Stream Key: ${primaryKey[3]}\n`);
  console.log(chalk`MediaLive Backup Ingest Url: {blue.underline ${output.oMediaLiveBackupIngestUrl}}`);
  var backupKey = output.oMediaLiveBackupIngestUrl.split('/');
  console.log(chalk`MediaLive Backup Stream Key: ${backupKey[3]}`);
  
  if (output.oPrimaryHlsEgress || output.oPrimaryCmafEgress || output.oPrimaryDashEgress || output.oPrimaryMssEgress){
    console.log(chalk.bold("\nMediaPackage"));
  }
  if (output.oPrimaryHlsEgress){
    console.log(chalk`MediaPackage HLS Egress Url: {blue.underline ${output.oPrimaryHlsEgress}}`);
  }
  if (output.oPrimaryDashEgress){
    console.log(chalk`MediaPackage Dash Egress Url: {blue.underline ${output.oPrimaryDashEgress}}`);
  }
  if (output.oPrimaryMssEgress){
    console.log(chalk`MediaPackage MSS Egress Url: {blue.underline ${output.oPrimaryMssEgress}}`);
  }
  if (output.oPrimaryCmafEgress){
    console.log(chalk`MediaPackage CMAF Egress Url: {blue.underline ${output.oPrimaryCmafEgress}}`);
  }

  if(output.oMediaStoreContainerName){
    console.log(chalk.bold("\nMediaStore"));
    console.log(chalk`MediaStore Output Url: {blue.underline ${output.oPrimaryMediaStoreEgressUrl}}`);
  }

  
}
