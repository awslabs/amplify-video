const inquirer = require('inquirer');
const chalk = require('chalk');

module.exports = (context) => {
  context.getInfo = async () => {
    await getVideoInfo(context);
  };

  context.getInfoAll = async () => {
    await getInfoVideoAll(context);
  };
};

async function getInfoVideoAll(context) {
  const amplifyMeta = context.amplify.getProjectMeta();
  if ("video" in amplifyMeta && Object.keys(amplifyMeta.video).length !== 0) {
    Object.values(amplifyMeta.video).forEach((project) => {
      if ("output" in project) {
        if ("oMediaLivePrimaryIngestUrl" in project.output){
          prettifyOutputLive(project.output);
        }
      }
    });
  }
}


async function getVideoInfo(context) {
  let project;
  const amplifyMeta = context.amplify.getProjectMeta();
  if (!("video" in amplifyMeta) || Object.keys(amplifyMeta.video).length === 0) {
    console.log(chalk.bold('You have no video projects.'));
  } else {
    const chooseProject = [
      {
        type: 'list',
        name: 'resourceName',
        message: 'Choose what project you want to get info for?',
        choices: Object.keys(amplifyMeta.video),
        default: Object.keys(amplifyMeta.video)[0],
      },
    ];
    project = await inquirer.prompt(chooseProject);
    if ("output" in amplifyMeta.video[project.resourceName]) {
      if ("oMediaLivePrimaryIngestUrl" in amplifyMeta.video[project.resourceName].output){
        await prettifyOutputLive(amplifyMeta.video[project.resourceName].output);
      }
    } else {
      console.log(chalk`{bold You have not pushed ${project.resourceName} to the cloud yet.}`);
    }
  }
}

async function prettifyOutputLive(output) {
  console.log(chalk.bold('\nMediaLive'));
  console.log(chalk`MediaLive Primary Ingest Url: {blue.underline ${output.oMediaLivePrimaryIngestUrl}}`);
  const primaryKey = output.oMediaLivePrimaryIngestUrl.split('/');
  console.log(chalk`MediaLive Primary Stream Key: ${primaryKey[3]}\n`);
  console.log(chalk`MediaLive Backup Ingest Url: {blue.underline ${output.oMediaLiveBackupIngestUrl}}`);
  const backupKey = output.oMediaLiveBackupIngestUrl.split('/');
  console.log(chalk`MediaLive Backup Stream Key: ${backupKey[3]}`);

  if (output.oPrimaryHlsEgress || output.oPrimaryCmafEgress
    || output.oPrimaryDashEgress || output.oPrimaryMssEgress) {
    console.log(chalk.bold('\nMediaPackage'));
  }
  if (output.oPrimaryHlsEgress) {
    console.log(chalk`MediaPackage HLS Egress Url: {blue.underline ${output.oPrimaryHlsEgress}}`);
  }
  if (output.oPrimaryDashEgress) {
    console.log(chalk`MediaPackage Dash Egress Url: {blue.underline ${output.oPrimaryDashEgress}}`);
  }
  if (output.oPrimaryMssEgress) {
    console.log(chalk`MediaPackage MSS Egress Url: {blue.underline ${output.oPrimaryMssEgress}}`);
  }
  if (output.oPrimaryCmafEgress) {
    console.log(chalk`MediaPackage CMAF Egress Url: {blue.underline ${output.oPrimaryCmafEgress}}`);
  }

  if (output.oMediaStoreContainerName) {
    console.log(chalk.bold('\nMediaStore'));
    console.log(chalk`MediaStore Output Url: {blue.underline ${output.oPrimaryMediaStoreEgressUrl}}`);
  }
}
