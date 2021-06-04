const chalk = require('chalk');
const fs = require('fs');
const ini = require('ini');

module.exports = {
  setupOBS,
};

async function setupOBS(context, resourceName) {
  const { amplify } = context;
  const amplifyMeta = amplify.getProjectMeta();
  if ('output' in amplifyMeta.video[resourceName]) {
    await createConfig(context, amplifyMeta.video[resourceName], resourceName);
  } else {
    context.print.warning(chalk`{bold You have not pushed ${resourceName} to the cloud yet.}`);
  }
}

async function createConfig(context, projectConfig, projectName) {
  // check for obs installation!
  let profileDir = '';
  const projectDetails = context.amplify.getProjectDetails();
  if (process.platform === 'darwin') {
    profileDir = `${process.env.HOME}/Library/Application Support/obs-studio/basic/profiles/`;
  } else if (process.platform === 'win32') {
    profileDir = `${process.env.APPDATA}/obs-studio/basic/profiles/`;
  } else {
    profileDir = '';
  }

  if (!fs.existsSync(profileDir)) {
    // Ask if they want to continue later
    context.print.info('OBS profile not folder not found. Switching to project folder.');
    profileDir = `${process.env.PWD}/OBS/`;
    fs.mkdirSync(profileDir);
  }

  profileDir = `${profileDir + projectName}/`;

  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir);
  }

  if (projectConfig.serviceType === 'livestream') {
    generateINILive(projectName, profileDir);
    generateServiceLive(profileDir, projectConfig.output.oMediaLivePrimaryIngestUrl);
  } else if (projectConfig.serviceType === 'ivs') {
    const targetDir = context.amplify.pathManager.getBackendDirPath();
    const props = JSON.parse(fs.readFileSync(`${targetDir}/video/${projectName}/${projectDetails.localEnvInfo.envName}-props.json`));
    generateINIIVS(projectName, profileDir, props);
    generateServiceIVS(profileDir, projectConfig.output);
  }

  context.print.success('\nConfiguration complete.');
  context.print.blue(chalk`Open OBS and select {bold ${projectName}} profile to use the generated profile for OBS`);
}

function generateINIIVS(projectName, directory, props) {
  let iniBasic;
  if (props.channel.channelQuality === 'STANDARD') {
    iniBasic = ini.parse(fs.readFileSync(`${__dirname}/../obs-templates/hd-ivs.ini`, 'utf-8'));
  } else {
    iniBasic = ini.parse(fs.readFileSync(`${__dirname}/../obs-templates/sd-ivs.ini`, 'utf-8'));
  }
  iniBasic.General.Name = projectName;
  fs.writeFileSync(`${directory}basic.ini`, ini.stringify(iniBasic));
}

function generateINILive(projectName, directory) {
  const iniBasic = ini.parse(fs.readFileSync(`${__dirname}/../obs-templates/basic.ini`, 'utf-8'));
  iniBasic.General.Name = projectName;
  fs.writeFileSync(`${directory}basic.ini`, ini.stringify(iniBasic));
}

function generateServiceIVS(directory, projectOutput) {
  // TODO: Write advanced setting setup for keyframes for lower latency!
  const setup = {
    settings: {
      key: projectOutput.oVideoInputKey,
      server: `rtmps://${projectOutput.oVideoInputURL}`,
    },
    type: 'rtmp_custom',
  };
  const json = JSON.stringify(setup);
  fs.writeFileSync(`${directory}service.json`, json);
}

function generateServiceLive(directory, primaryURL) {
  const primaryKey = primaryURL.split('/');
  const setup = {
    settings: {
      key: primaryKey[3],
      server: `rtmps://${primaryURL}`,
    },
    type: 'rtmp_custom',
  };
  const json = JSON.stringify(setup);
  fs.writeFileSync(`${directory}service.json`, json);
}
