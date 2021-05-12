const chalk = require('chalk');
const ejs = require('ejs');
const fs = require('fs');
const ora = require('ora');
const xcode = require('xcode');
const { exec } = require('./headless-mode');
const videoPlayerUtils = require('./video-player-utils');

module.exports = {
  setupVideoPlayer,
};

async function setupAndroidProject(context, resourceName) {
  const { amplify } = context;
  const amplifyMeta = amplify.getProjectMeta();
  const { serviceType, output } = amplifyMeta.video[resourceName];
  const projectRootPath = amplify.pathManager.searchProjectRootPath();
  const androidManifest = await videoPlayerUtils.parseAndroidManifest(`${projectRootPath}/app/src/main/AndroidManifest.xml`);
  const sourcePath = `${projectRootPath}/app/src/main/java/${androidManifest.manifest.$.package.split('.').join('/')}`;
  const resPath = `${projectRootPath}/app/src/main/res/layout`;
  const buildGradlePath = `${projectRootPath}/app/build.gradle`;
  const props = {
    packageName: androidManifest.manifest.$.package,
    src: videoPlayerUtils.getServiceUrl({ serviceType, output }),
  };
  const videoTemplate = fs.readFileSync(`${__dirname}/../video-player-templates/android/video-player.ejs`, { encoding: 'utf-8' });
  const appendVideoTemplate = ejs.render(videoTemplate, props);
  const spinner = ora();

  fs.writeFileSync(`${sourcePath}/VideoPlayerActivity.kt`, appendVideoTemplate);
  fs.writeFileSync(`${resPath}/activity_video_player.xml`, fs.readFileSync(`${__dirname}/../video-player-templates/android/activity_video_player.xml`));
  if (!videoPlayerUtils.isGradleDependencyInstalled(buildGradlePath, 'com.google.android.exoplayer:exoplayer')) {
    spinner.info('Adding EXOPlayer dependency');
    videoPlayerUtils.appendGradleDependency(buildGradlePath, 'com.google.android.exoplayer:exoplayer:2.13.2');
  } else {
    spinner.info('EXOPlayer is already installed');
  }
  spinner.succeed('Configuration complete, please reload your gradle dependencies.');
  context.print.blue(chalk`{underline A new Android Activity has been created:}`);
  context.print.info(`${sourcePath}/VideoPlayerActivity.kt`);
}

async function setupVideoPlayer(context, resourceName) {
  const { amplify } = context;
  const amplifyMeta = amplify.getProjectMeta();

  if ('output' in amplifyMeta.video[resourceName]) {
    if (videoPlayerUtils.getProjectConfig(context).frontend === 'ios') {
      await setupIosProject(context, resourceName);
    } else if (videoPlayerUtils.getProjectConfig(context).frontend === 'android') {
      await setupAndroidProject(context, resourceName);
    } else {
      await setupWebProjects(context, resourceName);
    }
  } else {
    context.print.warning(chalk`{bold You have not pushed ${resourceName} to the cloud yet.}`);
  }
}

async function setupIosProject(context, resourceName) {
  const { amplify } = context;
  const amplifyMeta = amplify.getProjectMeta();
  const { serviceType, output } = amplifyMeta.video[resourceName];
  const projectRootPath = amplify.pathManager.searchProjectRootPath();
  const framework = videoPlayerUtils.getProjectConfig(context).frontend;
  const pbxprojPath = `${projectRootPath}/${videoPlayerUtils.getProjectConfig(context).projectName}.xcodeproj/project.pbxproj`;
  const pbxproj = xcode.project(pbxprojPath);
  const props = {};

  await videoPlayerUtils.installIosDependencies(context);

  props.src = videoPlayerUtils.getServiceUrl({ serviceType, output });
  props.creationDate = new Date();
  props.projectName = videoPlayerUtils.getProjectConfig(context).projectName;

  const videoTemplate = fs.readFileSync(`${__dirname}/../video-player-templates/ios/video-player.ejs`, { encoding: 'utf-8' });
  const appendVideoTemplate = ejs.render(videoTemplate, props);
  const videoComponentTemplate = fs.readFileSync(`${__dirname}/../video-player-templates/ios/${framework}-video-component.ejs`, { encoding: 'utf-8' });

  ['h', 'cpp', 'hpp'].map(extension => videoPlayerUtils.genIosSourcesAndHeaders(context, props, extension));

  fs.writeFileSync(`${projectRootPath}/${videoPlayerUtils.getProjectConfig(context).projectName}/VideoPlayer.${videoPlayerUtils.fileExtension(framework)}`, appendVideoTemplate);
  const parser = pbxproj.parseSync();
  const [hash] = Object.entries(parser.hash.project.objects.PBXGroup).find(
    ([, group]) => group.path === videoPlayerUtils.getProjectConfig(context).projectName,
  );

  pbxproj.addSourceFile(`VideoPlayer.${videoPlayerUtils.fileExtension(framework)}`, {}, hash);
  pbxproj.addSourceFile('empty.cpp', {}, hash);
  pbxproj.addHeaderFile('empty.hpp', {}, hash);
  pbxproj.addHeaderFile(`${videoPlayerUtils.getProjectConfig(context).projectName}-Bridging-Header.h`, {}, hash);
  pbxproj.addBuildProperty('SWIFT_OBJC_BRIDGING_HEADER', `${videoPlayerUtils.getProjectConfig(context).projectName}/${videoPlayerUtils.getProjectConfig(context).projectName}-Bridging-Header.h`, 'Debug');
  pbxproj.addBuildProperty('SWIFT_OBJC_BRIDGING_HEADER', `${videoPlayerUtils.getProjectConfig(context).projectName}/${videoPlayerUtils.getProjectConfig(context).projectName}-Bridging-Header.h`, 'Release');
  fs.writeFileSync(pbxprojPath, pbxproj.writeSync());

  context.print.blue(chalk`{underline Import and add the following ${framework} component to your ContentView:}`);
  context.print.info(videoComponentTemplate);
}

async function setupWebProjects(context, resourceName) {
  const { amplify } = context;
  const amplifyMeta = amplify.getProjectMeta();
  const { serviceType, output } = amplifyMeta.video[resourceName];
  const { framework, config } = videoPlayerUtils
    .getProjectConfig(context)[videoPlayerUtils.getProjectConfig(context).frontend];
  const projectRootPath = amplify.pathManager.searchProjectRootPath();
  const props = {
    framework,
  };

  const videoTemplate = fs.readFileSync(`${__dirname}/../video-player-templates/web/video-player.ejs`, { encoding: 'utf-8' });
  const appendVideoTemplate = ejs.render(videoTemplate, props);
  const videoComponentTemplate = fs.readFileSync(`${__dirname}/../video-player-templates/web/${framework}-video-component.ejs`, { encoding: 'utf-8' });
  props.src = videoPlayerUtils.getServiceUrl({ serviceType, output });

  const appendVideoComponentTemplate = ejs.render(videoComponentTemplate, props);

  switch (framework) {
    case 'angular':
      fs.mkdirSync(`${projectRootPath}/${config.SourceDir}/app/video-player`, { recursive: true });
      fs.copyFileSync(`${__dirname}/../video-player-templates/web/video-player.component.scss`,
        `${projectRootPath}/${config.SourceDir}/app/video-player/video-player.component.scss`);
      fs.writeFileSync(`${projectRootPath}/${config.SourceDir}/app/video-player/video-player.component.${videoPlayerUtils.fileExtension(framework)}`, appendVideoTemplate);
      context.print.info("Don't forget to add the component to your angular module");
      break;
    case 'vue':
      fs.writeFileSync(`${projectRootPath}/${config.SourceDir}/components/VideoPlayer.${videoPlayerUtils.fileExtension(framework)}`, appendVideoTemplate);
      break;
    case 'ember':
      fs.writeFileSync(`${projectRootPath}/${config.SourceDir}/app/components/video-player.${videoPlayerUtils.fileExtension(framework)}`, appendVideoTemplate);
      break;
    case 'none':
      break;
    default:
      fs.writeFileSync(`${projectRootPath}/${config.SourceDir}/VideoPlayer.${videoPlayerUtils.fileExtension(framework)}`, appendVideoTemplate);
      break;
  }

  if (framework !== 'none') {
    const spinner = ora('Checking package.json dependencies...');
    spinner.start();
    if (!videoPlayerUtils.checkNpmDependencies(context, 'video.js')) {
      spinner.text = 'Adding video.js to package.json...';
      await exec('npm', ['install', 'video.js'], false);
    }
    spinner.succeed('Configuration complete.');
    context.print.blue(chalk`{underline Import and add the following ${framework} component:}`);
  } else {
    context.print.blue(chalk`{underline Copy and paste the following snippet of code:}`);
  }
  context.print.info(appendVideoComponentTemplate);
}
