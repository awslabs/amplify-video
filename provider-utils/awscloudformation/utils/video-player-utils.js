const fs = require('fs');
const readLastLines = require('read-last-lines');
const ora = require('ora');
const ejs = require('ejs');
const { exec } = require('./headless-mode');

module.exports = {
  getProjectConfig,
  fileExtension,
  getServiceUrl,
  isVLCKitInstalled,
  installIosDependencies,
  checkNpmDependencies,
  genIosSourcesAndHeaders,
};

function getProjectConfig(context) {
  const projectConfigFilePath = context.amplify.pathManager.getProjectConfigFilePath();
  let projectConfig = fs.readFileSync(projectConfigFilePath, { encoding: 'utf-8' });
  projectConfig = JSON.parse(projectConfig);
  return projectConfig;
}

function fileExtension(framework) {
  switch (framework) {
    case 'react':
      return 'jsx';
    case 'vue':
      return 'vue';
    case 'angular':
      return 'ts';
    case 'ember':
      return 'js';
    case 'ionic':
      return 'ts';
    case 'ios':
      return 'swift';
    default:
  }
}

function getServiceUrl(amplifyVideoMeta) {
  const { serviceType, output } = amplifyVideoMeta;

  switch (serviceType) {
    case 'livestream':
      return output.oPrimaryMediaStoreEgressUrl;
    case 'ivs':
      return output.oVideoOutput;
    case 'video-on-demand':
      if (output.oVodOutputUrl) {
        return `https://${output.oVodOutputUrl}/{path}/{path.m3u8}`;
      }
      return output.oVODOutputS3;
    default:
  }
}

function genIosSourcesAndHeaders(context, props, extension) {
  let template;
  const { amplify } = context;
  const projectRootPath = amplify.pathManager.searchProjectRootPath();

  if (extension === 'h') {
    template = fs.readFileSync(`${__dirname}/../video-player-templates/ios/bridging-header.${extension}.ejs`, { encoding: 'utf-8' });
    fs.writeFileSync(`${projectRootPath}/${getProjectConfig(context).projectName}/${getProjectConfig(context).projectName}-Bridging-Header.${extension}`, ejs.render(template, props));
  } else {
    template = fs.readFileSync(`${__dirname}/../video-player-templates/ios/empty.${extension}.ejs`, { encoding: 'utf-8' });
    fs.writeFileSync(`${projectRootPath}/${getProjectConfig(context).projectName}/empty.${extension}`, ejs.render(template, props));
  }
}

function isVLCKitInstalled(podfile, projectName) {
  if (podfile.target_definitions[0].children) {
    const { children } = podfile.target_definitions[0];
    if (children.length > 0) {
      return children.some((child) => {
        if (child.name === projectName) {
          if (!child.dependencies) {
            return false;
          }
          return child.dependencies.some(dependency => dependency.MobileVLCKit);
        }
        return false;
      });
    }
  }
}

async function installIosDependencies(context) {
  const { amplify } = context;
  const projectRootPath = amplify.pathManager.searchProjectRootPath();

  try {
    fs.readFileSync(`${projectRootPath}/Podfile`, { encoding: 'utf-8' });
    let podFileData = await exec('pod', ['ipc', 'podfile-json', 'Podfile'], false);
    podFileData = JSON.parse(podFileData);
    if (isVLCKitInstalled(podFileData, getProjectConfig(context).projectName)) {
      context.print.info('Podfile already contains MobileVLCKit');
      await exec('pod', ['install'], true);
    } else {
      const lines = await readLastLines.read(`${projectRootPath}/Podfile`, 1);
      const toVanquish = lines.length;
      const stats = fs.statSync(`${projectRootPath}/Podfile`);
      fs.truncateSync(`${projectRootPath}/Podfile`, stats.size - toVanquish);
      fs.appendFileSync(`${projectRootPath}/Podfile`, "\tplatform :ios, '8.4'\n\tpod 'MobileVLCKit', '~>3.3.0'\nend");
      const spinner = ora('Checking package.json dependencies...');
      spinner.start();
      spinner.text = 'Installing MobileVLCKit with CocoaPods...';
      await exec('pod', ['install'], true);
      spinner.succeed('Configuration complete.');
    }
  } catch (error) {
    throw new Error(error);
  }
}

function checkNpmDependencies(context, dependency) {
  const projectRootPath = context.amplify.pathManager.searchProjectRootPath();
  const packageJSONFile = fs.readFileSync(`${projectRootPath}/package.json`, { encoding: 'utf-8' });
  const packageJSON = JSON.parse(packageJSONFile);
  if (!packageJSON.dependencies[dependency]) {
    return false;
  }
  return true;
}
