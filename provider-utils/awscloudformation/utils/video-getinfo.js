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
  const props = {};
  let filePath = '';

  if (projectConfig.frontend === 'ios') {
    filePath = './videoconfiguration.json';
  } else if (projectConfig.frontend === 'android') {
    filePath = `./${projectConfig.android.config.ResDir}/raw/videoconfiguration.json`;
  } else if (projectConfig.frontend === 'javascript') {
    filePath = `./${projectConfig.javascript.config.SourceDir}/aws-video-exports.js`;
  } else {
    // Default location in json. Worst case scenario
    filePath = './aws-video-exports.json';
  }

  if (projectConfig.frontend === 'javascript') {
    await constructVideoConfigJS(amplifyMeta, props);
    const copyJobs = [
      {
        dir: __dirname,
        template: 'exports-templates/aws-video-exports.js.ejs',
        target: filePath,
      },
    ];
    await context.amplify.copyBatch(context, copyJobs, props, true);
  } else {
    await constructVideoConfigMobile(amplifyMeta, props);
    fs.writeFileSync(filePath, JSON.stringify(props, null, 4));
  }
}

async function constructVideoConfigJS(metadata, props) {
  const categoryName = 'video';
  Object.keys(metadata.video).forEach((resourceName) => {
    const resource = metadata[categoryName][resourceName];
    const { serviceType, output } = resource;
    if (output) {
      props[serviceType] = props[serviceType] || {};
      props[serviceType][resourceName] = props[serviceType][resourceName] || {};
      props[serviceType][resourceName] = {
        // VoD properties (when applicable)
        aws_video_inputS3Bucket: output.oVODInputS3,
        aws_video_outputUrl: output.oVodOutputUrl ? `https://${output.oVodOutputUrl}` : undefined,
        aws_video_outputS3Bucket: output.oVODOutputS3,

        // Livestream properties (when applicable)
        aws_video_primaryIngress: output.oMediaLivePrimaryIngestUrl,
        aws_video_backupIngress: output.oMediaLiveBackupIngestUrl,
        aws_video_hlsEgress: output.oPrimaryHlsEgress,
        aws_video_dashEgress: output.oPrimaryDashEgress,
        aws_video_mssEgress: output.oPrimaryMssEgress,
        aws_video_cmafEfress: output.oPrimaryCmafEgress,
        aws_video_mediastoreEgress: output.oPrimaryMediaStoreEgressUrl,
      };
    }
  });
}

async function constructVideoConfigMobile(metadata, props) {
  const categoryName = 'video';
  const pluginName = 'awsVideoPlugin';
  if (metadata[categoryName]) {
    Object.keys(metadata[categoryName]).forEach((resourceName) => {
      const resource = metadata[categoryName][resourceName];
      if (resource.output) {
        /* eslint-disable */
        props[categoryName] = props[categoryName] || {};
        props[categoryName].plugins = props[categoryName].plugins || {};
        props[categoryName].plugins[pluginName] = props[categoryName].plugins[pluginName] || {};
        props[categoryName].plugins[pluginName][resourceName] = props[categoryName].plugins[pluginName][resourceName] || {};
        /* eslint-enable */

        const resourceConfig = props[categoryName].plugins[pluginName][resourceName];

        if (resource.serviceType === 'livestream') {
          resourceConfig.type = 'LIVE';
          resourceConfig.ingress = {
            primary: resource.output.oMediaLivePrimaryIngestUrl,
            backup: resource.output.oMediaLiveBackupIngestUrl,
          };
          const primaryKey = resource.output.oMediaLivePrimaryIngestUrl.split('/')[3];
          const backupKey = resource.output.oMediaLiveBackupIngestUrl.split('/')[3];
          resourceConfig.keys = {
            primary: primaryKey,
            backup: backupKey,
          };
          resourceConfig.egress = {
            hls: resource.output.oPrimaryHlsEgress,
            dash: resource.output.oPrimaryDashEgress,
            mss: resource.output.oPrimaryMssEgress,
            cmaf: resource.output.oPrimaryCmafEgress,
            mediastore: resource.output.oPrimaryMediaStoreEgressUrl,
          };
        } else if (resource.serviceType === 'video-on-demand') {
          resourceConfig.type = 'ON_DEMAND';
          resourceConfig.input = resource.output.oVODInputS3;
          resourceConfig.output = resource.output.oVodOutputUrl;
        }
      }
    });
  }
}


async function getVideoInfo(context, resourceName) {
  const amplifyMeta = context.amplify.getProjectMeta();
  if ('output' in amplifyMeta.video[resourceName]) {
    if ('oMediaLivePrimaryIngestUrl' in amplifyMeta.video[resourceName].output) {
      await prettifyOutputLive(context, amplifyMeta.video[resourceName].output);
    } else {
      await prettifyOutputVod(context, amplifyMeta.video[resourceName].output);
    }
    await generateAWSExportsVideo(context);
  } else {
    context.print.warning(chalk`{bold You have not pushed ${resourceName} to the cloud yet.}`);
  }
}

async function prettifyOutputLive(context, output) {
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
  context.print.blue(chalk`\nInput Storage bucket: ${output.oVODInputS3}\n`);
  if (output.oVodOutputUrl) {
    context.print.blue(chalk`Output URL for content: {underline https://${output.oVodOutputUrl}}`);
  } else {
    context.print.blue(chalk`Output Storage bucket: ${output.oVODOutputS3}`);
  }
}
