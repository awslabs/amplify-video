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
  const amplifyMeta = context.amplify.getProjectMeta();
  let filePath = '';

  if (projectConfig.frontend === 'ios') {
    filePath = './amplifyvideoconfiguration.json';
  } else if (projectConfig.frontend === 'android') {
    filePath = `./${projectConfig.android.config.ResDir}/raw/amplifyvideoconfiguration.json`;
  } else if (projectConfig.frontend === 'javascript') {
    filePath = `./${projectConfig.javascript.config.SourceDir}/aws-video-exports.js`;
  } else {
    // Default location in json. Worst case scenario
    filePath = './aws-video-exports.json';
  }

  if (projectConfig.frontend === 'javascript') {
    const props = constructVideoConfigJS(amplifyMeta);
    const copyJobs = [
      {
        dir: __dirname,
        template: 'exports-templates/aws-video-exports.js.ejs',
        target: filePath,
      },
    ];
    await context.amplify.copyBatch(context, copyJobs, props, true);
  } else {
    const props = constructVideoConfigMobile(amplifyMeta);
    fs.writeFileSync(filePath, JSON.stringify(props, null, 4));
  }
}

function constructVideoConfigJS(metadata) {
  const categoryName = 'video';
  const props = {
    // To be populated with video resources
  };
  if (metadata[categoryName]) {
    Object.keys(metadata[categoryName]).forEach((resourceName) => {
      const resource = metadata[categoryName][resourceName];
      const { output } = resource;
      if (output) {
        if (resource.serviceType === 'livestream') {
          props[resourceName] = {
            aws_video_hlsEgress: output.oPrimaryHlsEgress,
            aws_video_dashEgress: output.oPrimaryDashEgress,
            aws_video_mssEgress: output.oPrimaryMssEgress,
            aws_video_cmafEfress: output.oPrimaryCmafEgress,
            aws_video_mediastoreEgress: output.oPrimaryMediaStoreEgressUrl,
          };
        } else if (resource.serviceType === 'video-on-demand') {
          props[resourceName] = {
            aws_video_inputS3Bucket: output.oVODInputS3,
            aws_video_outputS3Bucket: output.oVODOutputS3,
            aws_video_outputUrl: output.oVodOutputUrl ? `https://${output.oVodOutputUrl}` : undefined,
          };
        }
      }
    });
  }
  return props;
}

function constructVideoConfigMobile(metadata) {
  const categoryName = 'video';
  const pluginName = 'awsVideoPlugin';
  const props = {
    [categoryName]: {
      plugins: {
        [pluginName]: {
          // To be populated with video resources
        },
      },
    },
  };
  if (metadata[categoryName]) {
    Object.keys(metadata[categoryName]).forEach((resourceName) => {
      const resource = metadata[categoryName][resourceName];
      const { output } = resource;
      if (output) {
        if (resource.serviceType === 'livestream') {
          props[categoryName].plugins[pluginName][resourceName] = {
            type: 'LIVE',
            egress: {
              hls: output.oPrimaryHlsEgress,
              dash: output.oPrimaryDashEgress,
              mss: output.oPrimaryMssEgress,
              cmaf: output.oPrimaryCmafEgress,
              mediastore: output.oPrimaryMediaStoreEgressUrl,
            },
          };
        } else if (resource.serviceType === 'video-on-demand') {
          props[categoryName].plugins[pluginName][resourceName] = {
            type: 'ON_DEMAND',
            input: output.oVODInputS3,
            output: output.oVODOutputS3,
            outputUrl: output.oVodOutputUrl ? `https://${output.oVodOutputUrl}` : undefined,
          };
        }
      }
    });
  }
  return props;
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
  context.print.blue('\nStream Keys:');
  context.print.blue(`${output.oVideoInputKey}\n`);
  context.print.blue('\nOutput url:');
  context.print.blue(chalk`{underline ${output.oVideoOutput}}\n`);
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
  context.print.blue(chalk`Input Storage bucket: ${output.oVODInputS3}\n`);
  if (output.oVodOutputUrl) {
    context.print.blue(chalk`Output URL for content: {underline https://${output.oVodOutputUrl}}`);
  } else {
    context.print.blue(chalk`Output Storage bucket: ${output.oVODOutputS3}`);
  }
}
