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

  generateINI(projectName, profileDir);
  if (projectConfig.serviceType === 'livestream') {
    generateServiceLive(profileDir, projectConfig.output.oMediaLivePrimaryIngestUrl);
  } else if (projectConfig.serviceType === 'ivs') {
    generateServiceIVS(profileDir, projectConfig.output);
  }

  context.print.success('\nConfiguration complete.');
  context.print.blue(chalk`Open OBS and select {bold ${projectName}} profile to use the generated profile for OBS`);
}

function generateINI(projectName, directory) {
  const iniBasic = ini.parse(fs.readFileSync(`${__dirname}/../obs-templates/basic.ini`, 'utf-8'));
  iniBasic.General.Name = projectName;
  fs.writeFileSync(`${directory}basic.ini`, ini.stringify(iniBasic));
}

function generateServiceIVS(directory, projectOutput) {
  const setup = {
    settings: {
      key: projectOutput.oVideoInputKey,
      server: projectOutput.oVideoInputURL,
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
