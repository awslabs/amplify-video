// Load the AWS SDK for Node.js
// eslint-disable-next-line import/no-extraneous-dependencies
/* eslint-disable */
const AWS = require('aws-sdk');
/* eslint-enable */
// Set the region
// Function to submit job to Elemental MediaConvert
async function createJob(eventObject) {
  let mcClient = new AWS.MediaConvert();
  const allOutputs = [];

  if (!AWS.config.mediaconvert) {
    try {
      const endpoints = await mcClient.describeEndpoints().promise();
      AWS.config.mediaconvert = { endpoint: endpoints.Endpoints[0].Url };
      // Override so config applies
      mcClient = new AWS.MediaConvert();
    } catch (e) {
      console.log(e);
      return;
    }
  }

  const queueParams = {
    Name: 'Default', /* required */
  };
  const AddedKey = eventObject.object.key;
  // Get the name of the file passed in the event without the extension
  const FileName = AddedKey.split('.').slice(0, -1).join('.');
  const Bucket = eventObject.bucket.name;
  const outputBucketName = process.env.OUTPUT_BUCKET;
  const tmplName = process.env.ARN_TEMPLATE.split(':')[5].split('/')[1];
  const tmpl = await mcClient.getJobTemplate({ Name: tmplName }).promise();

  tmpl.JobTemplate.Settings.OutputGroups.forEach(group => {
    if (group.OutputGroupSettings.Type === 'HLS_GROUP_SETTINGS') {
      group.OutputGroupSettings.HlsGroupSettings.Destination = `s3://${outputBucketName}/${FileName}/`;
      allOutputs.push({
        Name: 'Apple HLS',
        Outputs: [],
        OutputGroupSettings: group.OutputGroupSettings,
      });
    }

    if (group.OutputGroupSettings.Type === 'DASH_ISO_GROUP_SETTINGS') {
      group.OutputGroupSettings.DashIsoGroupSettings.Destination = `s3://${outputBucketName}/${FileName}/`;
      allOutputs.push({
        Name: 'DASH ISO',
        Outputs: [],
        OutputGroupSettings: group.OutputGroupSettings,
      });
    }

    if (group.OutputGroupSettings.Type === 'FILE_GROUP_SETTINGS') {
      group.OutputGroupSettings.DashIsoGroupSettings.Destination = `s3://${outputBucketName}/${FileName}/`;
      allOutputs.push({
        Name: 'File Group',
        Outputs: [],
        OutputGroupSettings: group.OutputGroupSettings,
      });
    }

    if (group.OutputGroupSettings.Type === 'MS_SMOOTH_GROUP_SETTINGS') {
      group.OutputGroupSettings.DashIsoGroupSettings.Destination = `s3://${outputBucketName}/${FileName}/`;
      allOutputs.push({
        Name: 'MS Smooth',
        Outputs: [],
        OutputGroupSettings: group.OutputGroupSettings,
      });
    }

    if (group.OutputGroupSettings.Type === 'CMAF_GROUP_SETTINGS') {
      group.OutputGroupSettings.DashIsoGroupSettings.Destination = `s3://${outputBucketName}/${FileName}/`;
      allOutputs.push({
        Name: 'CMAF',
        Outputs: [],
        OutputGroupSettings: group.OutputGroupSettings,
      });
    }
  });

  let queueARN = '';
  if (process.env.QUEUE_ARN) {
    queueARN = process.env.QUEUE_ARN;
  } else {
    const q = await mcClient.getQueue(queueParams, (err, data) => {
      if (err) console.log(err, err.stack); // an error occurred
      else console.log(data);
    }).promise();
    queueARN = q.Queue.Arn;
  }
  const allGroups = {
    OutputGroups: allOutputs,
    AdAvailOffset: 0,
    Inputs: [
      {
        AudioSelectors: {
          'Audio Selector 1': {
            Offset: 0,
            DefaultSelection: 'DEFAULT',
            ProgramSelection: 1,
          },
        },
        VideoSelector: {
          ColorSpace: 'FOLLOW',
        },
        FilterEnable: 'AUTO',
        PsiControl: 'USE_PSI',
        FilterStrength: 0,
        DeblockFilter: 'DISABLED',
        DenoiseFilter: 'DISABLED',
        TimecodeSource: 'ZEROBASED',
        FileInput: `s3://${Bucket}/${decodeURIComponent(AddedKey.replace(/\+/g, ' '))}`,
      },
    ],
  };

  const jobParams = {
    JobTemplate: process.env.ARN_TEMPLATE,
    Queue: queueARN,
    UserMetadata: {},
    Role: process.env.MC_ROLE,
    Settings: allGroups,
  };
  await mcClient.createJob(jobParams).promise();
}

exports.handler = async (event) => {
  AWS.config.update({ region: event.awsRegion });
  if (event.Records[0].eventName.includes('ObjectCreated')) {
    await createJob(event.Records[0].s3);
    const response = {
      statusCode: 200,
      body: JSON.stringify(`Transcoding your file: ${event.Records[0].s3.object.key}`),
    };
    return response;
  }
};
