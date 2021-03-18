const chalk = require('chalk');
const ejs = require('ejs');
const fs = require('fs');
const ora = require('ora');
const { exec } = require('./headless-mode');

module.exports = {
  setupPlayer,
};

function checkDependencies(context, dependency) {
  const projectRootPath = context.amplify.pathManager.searchProjectRootPath();
  const packageJSONFile = fs.readFileSync(`${projectRootPath}/package.json`, { encoding: 'utf-8' });
  const packageJSON = JSON.parse(packageJSONFile);
  if (!packageJSON.dependencies[dependency]) {
    return false;
  }
  return true;
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
      return 'hbs';
    case 'ionic':
      return 'ts';
    default:
  }
}

async function setupPlayer(context, resourceName) {
  const { amplify } = context;
  const amplifyMeta = amplify.getProjectMeta();
  if ('output' in amplifyMeta.video[resourceName]) {
    const projectConfigFilePath = context.amplify.pathManager.getProjectConfigFilePath();
    const { serviceType, output } = amplifyMeta.video[resourceName];
    let projectConfig = fs.readFileSync(projectConfigFilePath, { encoding: 'utf-8' });
    projectConfig = JSON.parse(projectConfig);
    const { framework, config } = projectConfig[projectConfig.frontend];

    const props = {
      framework,
    };
    const videoTemplate = fs.readFileSync(`${__dirname}/../player-templates/video-player.ejs`, { encoding: 'utf-8' });
    const appendVideoTemplate = ejs.render(videoTemplate, props);
    const videoComponentTemplate = fs.readFileSync(`${__dirname}/../player-templates/${framework}-video-component.ejs`, { encoding: 'utf-8' });
    switch (serviceType) {
      case 'livestream':
        props.src = output.oPrimaryMediaStoreEgressUrl;
        break;
      case 'ivs':
        props.src = output.oVideoOutput;
        break;
      case 'video-on-demand':
        props.src = `http://${output.oVodOutputUrl}/{path}/{path.m3u8}`;
        break;
      default:
    }
    const appendVideoComponentTemplate = ejs.render(videoComponentTemplate, props);

    switch (framework) {
      case 'angular':
        fs.mkdirSync(`${amplify.pathManager.searchProjectRootPath()}/${config.SourceDir}/app/video-player`, { recursive: true });
        fs.copyFileSync(`${__dirname}/../player-templates/video-player.component.scss`,
          `${amplify.pathManager.searchProjectRootPath()}/${config.SourceDir}/app/video-player/video-player.component.scss`);
        fs.writeFileSync(`${amplify.pathManager.searchProjectRootPath()}/${config.SourceDir}/app/video-player/video-player.component.${fileExtension(framework)}`, appendVideoTemplate);
        context.print.info("Don't forget to add the component to your angular module");
        break;
      case 'vue':
        fs.writeFileSync(`${amplify.pathManager.searchProjectRootPath()}/${config.SourceDir}/components/VideoPlayer.${fileExtension(framework)}`, appendVideoTemplate);
        break;
      default:
        fs.writeFileSync(`${amplify.pathManager.searchProjectRootPath()}/${config.SourceDir}/VideoPlayer.${fileExtension(framework)}`, appendVideoTemplate);
        break;
    }

    const spinner = ora('Checking package.json dependencies...');
    spinner.start();
    if (!checkDependencies(context, 'video.js')) {
      spinner.text = 'Adding video.js to package.json...';
      await exec('npm', ['install', 'video.js'], false);
    }
    spinner.succeed('Configuration complete.');
    context.print.blue(chalk`{underline Import and add the following ${framework} component:}`);
    context.print.info(appendVideoComponentTemplate);
  } else {
    context.print.warning(chalk`{bold You have not pushed ${resourceName} to the cloud yet.}`);
  }
}
