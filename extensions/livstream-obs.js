const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs');
const ini = require('ini');
var debug = false;

module.exports = context => {
  context.setupOBS = async () => {
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
  if (debug == true){
    prettifyOutput();
  } else {
  if (!amplifyMeta.Elemental){
    chalk.bold("You have no Elemental projects.");
  }
  const chooseProject = [
    {
      type: 'list',
      name: 'resourceName',
      message: 'Choose what project you want to configure OBS for?',
      choices: Object.keys(amplifyMeta.Elemental),
      default: Object.keys(amplifyMeta.Elemental)[0],
    }
  ];

  if(!amplify.Elemental && Object.keys(amplifyMeta.Elemental).length != 0){
    project = await inquirer.prompt(chooseProject);
    if (amplifyMeta.Elemental[project.resourceName].output){
      await prettifyOutput(amplifyMeta.Elemental[project.resourceName].output, project.resourceName);
    } else {
      console.log(chalk`{bold You have not pushed ${project.resourceName} to the cloud yet.}`);
    }
  } else {
    console.log(chalk.bold("You have no Elemental projects."));
    return;
  }
}
}

async function prettifyOutput(output, projectName){

  //check for obs installation!
  var profileDir = "";
  if (process.platform == "darwin"){
    profileDir = process.env.HOME + "/Library/Application Support/obs-studio/basic/profiles/";
  } else if (process.platform == "win32"){
    profileDir = process.env.APPDATA + "/obs-studio/basic/profiles/";
  } else {
    profileDir = "";
  }

  if (!fs.existsSync(profileDir)){
    //Ask if they want to continue later
    console.log("OBS profile not folder not found. Switching to project folder.");
    profileDir = process.env.PWD + "/OBS/";
    fs.mkdirSync(profileDir);
  }

  profileDir = profileDir + projectName + "/";

  if (!fs.existsSync(profileDir)){
      fs.mkdirSync(profileDir);
  }

  generateINI(projectName, profileDir);
  generateService(projectName, profileDir, output.oMediaLivePrimaryIngestUrl);

  console.log("Configuration complete.");
  console.log("Would you like to open OBS with this profile?")


  /*
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
    console.log(chalk`MediaPackage MSS Egress Url: {blue.underline \e]8;;${output.oPrimaryMssEgress}}e]8;;\a`);
  }
  if (output.oPrimaryCmafEgress){
    console.log(chalk`MediaPackage CMAF Egress Url: {blue.underline ${output.oPrimaryCmafEgress}}`);
  }

  if(output.oMediaStoreContainerName){
    console.log(chalk.bold("\nMediaStore"));
    console.log(chalk`MediaStore Output Url: {blue.underline ${output.oPrimaryMediaStoreEgressUrl}}`);
  }

  */
}

async function generateINI(projectName, directory){
  var iniBasic = ini.parse(fs.readFileSync(__dirname + '/obs-templates/basic.ini', 'utf-8'));
  iniBasic.General.Name = projectName;
  fs.writeFileSync(directory + 'basic.ini', ini.stringify(iniBasic));
}

async function generateService(projectName, directory, primaryURL){
  var primaryKey = primaryURL.split('/');
  var setup = {
    settings: {
      key: primaryKey[3],
      server: primaryURL
    },
    type: "rtmp_custom",
  }
  var json = JSON.stringify(setup);
  fs.writeFileSync(directory + 'service.json', json);
}
