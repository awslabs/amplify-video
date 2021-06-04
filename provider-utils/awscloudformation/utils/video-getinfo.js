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
        if (project.serviceType === 'video-on-demand') {
          prettifyOutputVod(context, project.output);
        } else if (project.serviceType === 'livestream') {
          prettifyOutputLive(context, project.output);
        } else if (project.serviceType === 'ivs') {
          prettifyOutputIVS(context, project.output);
        }
        if ('oMediaLivePrimaryIngestUrl' in project.output) {
          prettifyOutputLive(context, project.output);
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
  const projectMeta = context.amplify.getProjectMeta();
  const targetDir = context.amplify.pathManager.getBackendDirPath();
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

  if ('video' in projectMeta && Object.keys(projectMeta.video).length !== 0) {
    Object.values(projectMeta.video).forEach((project) => {
      const videoConfig = JSON.parse(fs.readFileSync(`${targetDir}/video/${project}/props.json`));
      if ('output' in project) {
        const { output } = project;
        if (project.serviceType === 'video-on-demand') {
          props.awsInputVideo = output.oVODInputS3;
          props.awsOutputVideo = output.oVodOutputUrl;
          props.protectedURLS = videoConfig.signedKey;
        } else if (project.serviceType === 'livestream') {
          if (output.oPrimaryHlsEgress) {
            props.awsOutputLiveHLS = output.oPrimaryHlsEgress;
          }
          if (output.oPrimaryDashEgress) {
            props.awsOutputLiveDash = output.oPrimaryDashEgress;
          }
          if (output.oPrimaryMssEgress) {
            props.awsOutputLiveMss = output.oPrimaryMssEgress;
          }
          if (output.oPrimaryCmafEgress) {
            props.awsOutputLiveCmaf = output.oPrimaryCmafEgress;
          }
          if (output.oMediaStoreContainerName) {
            props.awsOutputLiveLL = output.oPrimaryMediaStoreEgressUrl;
          }
        } else if (project.serviceType === 'ivs') {
          props.awsOutputIVS = output.oVideoOutput;
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
      await context.amplify.copyBatch(context, copyJobs, props, true);
    } else {
      fs.writeFileSync(filePath, JSON.stringify(props, null, 4));
    }
  }
}


async function getVideoInfo(context, resourceName) {
  const amplifyMeta = context.amplify.getProjectMeta();
  if ('output' in amplifyMeta.video[resourceName]) {
    if (amplifyMeta.video[resourceName].serviceType === 'video-on-demand') {
      await prettifyOutputVod(context, amplifyMeta.video[resourceName].output);
    } else if (amplifyMeta.video[resourceName].serviceType === 'livestream') {
      await prettifyOutputLive(context, amplifyMeta.video[resourceName].output);
    } else if (amplifyMeta.video[resourceName].serviceType === 'ivs') {
      await prettifyOutputIVS(context, amplifyMeta.video[resourceName].output);
    }
    await generateAWSExportsVideo(context);
  } else {
    context.print.warning(chalk`{bold You have not pushed ${resourceName} to the cloud yet.}`);
  }
}

async function prettifyOutputIVS(context, output) {
  context.print.info(chalk.bold('\nInteractive Video Service:'));
  context.print.blue('\nInput url:');
  context.print.blue(chalk`{underline rtmps://${output.oVideoInputURL}}\n`);
  context.print.blue('Stream Keys:');
  context.print.blue(`${output.oVideoInputKey}\n`);
  context.print.blue('Output url:');
  context.print.blue(chalk`{underline ${output.oVideoOutput}}\n`);
  context.print.blue('Channel ARN:');
  context.print.blue(`${output.oVideoChannelArn}\n`);
}

async function prettifyOutputLive(context, output) {
  context.print.info(chalk.bold('\nLivestream Info:'));
  context.print.info(chalk.bold('\nMediaLive'));
  context.print.blue(chalk`MediaLive Primary Ingest Url: {underline ${output.oMediaLivePrimaryIngestUrl}}`);
  const primaryKey = output.oMediaLivePrimaryIngestUrl.split('/');
  context.print.blue(`MediaLive Primary Stream Key: ${primaryKey[3]}\n`);
  context.print.blue(chalk`MediaLive Backup Ingest Url: {underline ${output.oMediaLiveBackupIngestUrl}}`);
  const backupKey = output.oMediaLiveBackupIngestUrl.split('/');
  context.print.blue(`MediaLive Backup Stream Key: ${backupKey[3]}`);

  if (output.oPrimaryHlsEgress || output.oPrimaryCmafEgress
    || output.oPrimaryDashEgress || output.oPrimaryMssEgress) {
    context.print.info(chalk.bold('\nMediaPackage'));
  }
  if (output.oPrimaryHlsEgress) {
    context.print.blue(chalk`MediaPackage HLS Egress Url: {underline ${output.oPrimaryHlsEgress}}`);
  }
  if (output.oPrimaryDashEgress) {
    context.print.blue(chalk`MediaPackage Dash Egress Url: {underline ${output.oPrimaryDashEgress}}`);
  }
  if (output.oPrimaryMssEgress) {
    context.print.blue(chalk`MediaPackage MSS Egress Url: {underline ${output.oPrimaryMssEgress}}`);
  }
  if (output.oPrimaryCmafEgress) {
    context.print.blue(chalk`MediaPackage CMAF Egress Url: {underline ${output.oPrimaryCmafEgress}}`);
  }

  if (output.oMediaStoreContainerName) {
    context.print.info(chalk.bold('\nMediaStore'));
    context.print.blue(chalk`MediaStore Output Url: {underline ${output.oPrimaryMediaStoreEgressUrl}}`);
  }
}

async function prettifyOutputVod(context, output) {
  context.print.info(chalk.bold('\nVideo on Demand:'));
  context.print.blue('\nInput Storage bucket:');
  context.print.blue(`${output.oVODInputS3}\n`);
  if (output.oVodOutputUrl) {
    context.print.blue('Output URL for content:');
    context.print.blue(chalk`{underline https://${output.oVodOutputUrl}\n}`);
  } else {
    context.print.blue('Output Storage bucket:');
    context.print.blue(`${output.oVODOutputS3}\n`);
  }
}
