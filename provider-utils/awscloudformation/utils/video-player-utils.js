const fs = require('fs');
const ora = require('ora');
const ejs = require('ejs');
const inquirer = require('inquirer');
const xmlParser = require('xml2js');
const { exec } = require('./headless-mode');

module.exports = {
  getProjectConfig,
  fileExtension,
  getServiceUrl,
  isVLCKitInstalled,
  installIosDependencies,
  checkNpmDependencies,
  genIosSourcesAndHeaders,
  parseAndroidManifest,
  isGradleDependencyInstalled,
  appendGradleDependency,
};

function getProjectConfig(context) {
  const projectConfigFilePath = context.amplify.pathManager.getProjectConfigFilePath();
  let projectConfig = fs.readFileSync(projectConfigFilePath, { encoding: 'utf-8' });
  projectConfig = JSON.parse(projectConfig);
  return projectConfig;
}

async function parseAndroidManifest(path) {
  const androidManifestFile = fs.readFileSync(path, { encoding: 'utf-8' });
  return xmlParser.parseStringPromise(androidManifestFile);
}

function isGradleDependencyInstalled(buildGradlePath, name) {
  const installPattern = new RegExp(`(implementation '${name}:(\\d+\\.)?(\\d+\\.)?(\\*|\\d+)')`);
  const buildGradle = fs.readFileSync(buildGradlePath);
  return installPattern.test(buildGradle);
}

function appendGradleDependency(buildGradlePath, dependency) {
  fs.writeFileSync(
    buildGradlePath,
    fs
      .readFileSync(buildGradlePath, 'utf8')
      .replace(/[^ \t]dependencies {(\r\n|\n)/, match => `${match}\timplementation '${dependency}'\n`),
  );
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

function readPodFile(path) {
  const podContent = fs.readFileSync(path, 'utf8');
  return podContent.split(/\r?\n/g);
}

function addPodEntry(
  podLines,
  linesToAddEntry,
  platformVersion,
  podName,
  podVersion,
) {
  const platform = `platform :ios, '${platformVersion}'`;
  const pod = `pod '${podName}', '~>${podVersion}'`;
  const { line, indentation } = linesToAddEntry;

  function getLineToAdd(newEntry, offset) {
    const spaces = Array(offset + 1).join(' ');
    return spaces + newEntry;
  }

  podLines.splice(line, 0, getLineToAdd(pod, indentation));
  podLines.splice(line, 0, getLineToAdd(platform, indentation));
}

function listTargets(podLines) {
  const target = /target ('|")\w+('|") do/g;
  const targets = [];

  for (let i = 0, len = podLines.length; i < len; i++) {
    const matchNextConstruct = podLines[i].match(target);

    if (matchNextConstruct) {
      const firstNonSpaceCharacter = podLines[i].search(/\S/);
      targets.push({
        name: podLines[i].replace(/target|do|'| /g, ''),
        value: { line: i + 1, indentation: firstNonSpaceCharacter + 2, target: podLines[i].replace(/target|do|'| /g, '') },
      });
    }
  }
  return targets;
}

function savePodFile(podfilePath, podLines) {
  const newPodfile = podLines.join('\n');
  fs.writeFileSync(podfilePath, newPodfile);
}

async function installIosDependencies(context) {
  const { amplify } = context;
  const projectRootPath = amplify.pathManager.searchProjectRootPath();

  try {
    fs.readFileSync(`${projectRootPath}/Podfile`, { encoding: 'utf-8' });
    let podFileData = await exec('pod', ['ipc', 'podfile-json', 'Podfile'], false);
    podFileData = JSON.parse(podFileData);
    const pod = readPodFile(`${projectRootPath}/Podfile`);
    const targets = listTargets(pod);
    const chooseTarget = [
      {
        type: 'list',
        name: 'podTarget',
        message: 'Choose which pod target you want to set up a player for?',
        choices: targets,
      },
    ];
    const props = await inquirer.prompt(chooseTarget);
    if (isVLCKitInstalled(podFileData, props.podTarget.target)) {
      context.print.info('Podfile already contains MobileVLCKit');
      const spinner = ora('Installing dependencies...');
      spinner.start();
      await exec('pod', ['install'], true);
      spinner.succeed('Configuration complete.');
    } else {
      addPodEntry(pod, props.podTarget, '8.4', 'MobileVLCKit', '3.3.0');
      savePodFile(`${projectRootPath}/Podfile`, pod);
      const spinner = ora('Installing MobileVLCKit with CocoaPods...');
      spinner.start();
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
