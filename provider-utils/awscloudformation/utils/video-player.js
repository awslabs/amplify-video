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

async function setupPlayer(context, resourceName) {
  const { amplify } = context;
  const amplifyMeta = amplify.getProjectMeta();
  if ('output' in amplifyMeta.video[resourceName]) {
    const projectConfigFilePath = context.amplify.pathManager.getProjectConfigFilePath();
    const { serviceType, output } = amplifyMeta.video[resourceName];
    let projectConfig = await fs.readFileSync(projectConfigFilePath, { encoding: 'utf-8' });
    projectConfig = JSON.parse(projectConfig);

    if (projectConfig[projectConfig.frontend].framework === 'react') {
      const props = {
        ivs: serviceType !== 'ivs',
      };
      const videoTemplate = await fs.readFileSync(`${__dirname}/../player-templates/video-player.jsx.ejs`, { encoding: 'utf-8' });
      const appendVideoTemplate = ejs.render(videoTemplate, props);
      const videoComponentTemplate = await fs.readFileSync(`${__dirname}/../player-templates/video-component.ejs`, { encoding: 'utf-8' });
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

      await fs.writeFileSync(`${context.amplify.pathManager.searchProjectRootPath()}/${projectConfig[projectConfig.frontend].config.SourceDir}/VideoPlayer.jsx`, appendVideoTemplate);

      const spinner = ora('Checking package.json dependencies...');
      spinner.start();
      if (!checkDependencies(context, 'video.js')) {
        spinner.text = 'Adding video.js to package.json...';
        await exec('npm', ['install', 'video.js'], false);
      }
      spinner.succeed('Configuration complete.');
      context.print.blue(chalk`{underline Import and add the following ${projectConfig[projectConfig.frontend].framework} component:}`);
      context.print.info(appendVideoComponentTemplate);
    } else {
      context.print.warning(chalk`{bold ${projectConfig[projectConfig.frontend].framework} is not supported for the moment.}`);
    }
  } else {
    context.print.warning(chalk`{bold You have not pushed ${resourceName} to the cloud yet.}`);
  }
}
