const chalk = require('chalk');
const fs = require('fs-extra');

module.exports = {
  getVideoInfo,
  getInfoVideoAll,
};

async function getInfoVideoAll(context) {
  const amplifyMeta = context.amplify.getProjectMeta();
  if ('video' in amplifyMeta && Object.keys(amplifyMeta.video).length !== 0) {
    Object.values(amplifyMeta.video).forEach((project) => {
      if ('output' in project) {
        if ('oMediaLivePrimaryIngestUrl' in project.output) {
          prettifyOutputLive(project.output);
        } else if ('oVODInputS3' in project.output) {
          prettifyOutputVod(context, project.output);
        }
      }
    });
    await generateAWSExportsVideo(context);
  }
}

async function generateAWSExportsVideo(context) {
  const projectConfig = context.amplify.getProjectConfig();
  const amplifyMeta = context.amplify.getProjectMeta();
  const props = {};
  let filePath = '';

  if (projectConfig.frontend === 'ios') {
    filePath = './aws-video-exports.json';
  } else if (projectConfig.frontend === 'android') {
    filePath = `./${projectConfig.android.config.ResDir}/aws-video-exports.json`;
  } else if (projectConfig.frontend === 'javascript') {
    filePath = `./${projectConfig.javascript.config.SourceDir}/aws-video-exports.js`;
  } else {
    // Default location in json. Worst case scenario
    filePath = './aws-video-exports.json';
  }

  // TODO write a way to handle multiple projects. Only handles one vod project for right now!
  Object.values(amplifyMeta.video).forEach((project) => {
    if ('output' in project) {
      if ('oVODOutputS3' in project.output) {
        props.awsInputVideo = project.output.oVODInputS3;
        props.awsOutputVideo = project.output.oVODOutputS3;
      } else if ('oVodOutputUrl' in project.output) {
        props.awsInputVideo = project.output.oVODInputS3;
        props.awsOutputVideo = project.output.oVodOutputUrl;
      }
    }
  });

  if (projectConfig.frontend === 'javascript') {
    const copyJobs = [
      {
        dir: __dirname,
        template: 'exports-templates/aws-video-exports.js.ejs',
        target: filePath,
      },
    ];
    await context.amplify.copyBatch(context, copyJobs, props);
  } else {
    fs.writeFileSync(filePath, JSON.stringify(props, null, 4));
  }
}


async function getVideoInfo(context, resourceName) {
  const amplifyMeta = context.amplify.getProjectMeta();
  if ('output' in amplifyMeta.video[resourceName]) {
    if ('oMediaLivePrimaryIngestUrl' in amplifyMeta.video[resourceName].output) {
      await prettifyOutputLive(amplifyMeta.video[resourceName].output);
    } else {
      await prettifyOutputVod(context, amplifyMeta.video[resourceName].output);
    }
    await generateAWSExportsVideo(context);
  } else {
    console.log(chalk`{bold You have not pushed ${resourceName} to the cloud yet.}`);
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

async function prettifyOutputVod(context, output) {
  context.print.blue('Input Storage bucket:');
  context.print.blue(`${output.oVODInputS3}\n`);
  if (output.oVodOutputUrl) {
    context.print.blue('Output URL for content:');
    context.print.blue(`${output.oVodOutputUrl}\n`);
  } else {
    context.print.blue('Output Storage bucket:');
    context.print.blue(`${output.oVODOutputS3}\n`);
  }
}
