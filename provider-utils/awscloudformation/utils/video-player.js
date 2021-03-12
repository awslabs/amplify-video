const chalk = require('chalk');
const ejs = require('ejs');
const fs = require('fs');
const { exec } = require('./headless-mode');

module.exports = {
  setupPlayer,
};

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
      const appendVideoComponentTemplate = ejs.render(videoComponentTemplate, { src: output.oVideoOutput });

      await fs.writeFileSync(`${context.amplify.pathManager.searchProjectRootPath()}/${projectConfig[projectConfig.frontend].config.SourceDir}/VideoPlayer.jsx`, appendVideoTemplate);
      context.print.info(chalk.bold('Installing video.js package.'));
      await exec('npm', ['install', 'video.js']);
      if (serviceType.ivs) {
        await exec('npm', ['install', 'amazon-ivs-player']);
      }
      context.print.success('Configuration complete.');
      context.print.success(`Copy the following ${projectConfig[projectConfig.frontend].framework} component:\n`);
      context.print.info(appendVideoComponentTemplate);
    } else {
      context.print.warning(chalk`{bold ${projectConfig[projectConfig.frontend].framework} is not supported for the moment.}`);
    }
  } else {
    context.print.warning(chalk`{bold You have not pushed ${resourceName} to the cloud yet.}`);
  }
}
