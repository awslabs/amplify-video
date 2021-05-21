// Load the AWS SDK for Node.js
// eslint-disable-next-line import/no-extraneous-dependencies
/* eslint-disable */
const AWS = require('aws-sdk');
/* eslint-enable */
const hlsJobSettings = require('./hls_settings.json');
const dashJobSettings = require('./dash_settings.json');
const hlsdashJobSettings = require('./hls_dash_settings.json');
// Set the region

exports.handler = async (event) => {
  AWS.config.update({ region: event.awsRegion });
  console.log(event);
  if (event.Records[0].eventName.includes('ObjectCreated')) {
    await createJob(event.Records[0].s3);
    const response = {
      statusCode: 200,
      body: JSON.stringify(`Transcoding your file: ${event.Records[0].s3.object.key}`),
    };
    return response;
  }
};

// Function to submit job to Elemental MediaConvert
async function createJob(eventObject) {
  let mcClient = new AWS.MediaConvert();
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
  const hlsRendition = 'hls';
  const dashRendition = 'dash';

  // Set the output to have the filename (without extension) as a folder depending
  // on the type of rendition this is required as the job json for HLS differs from DASH
  const outputType = process.env.TEMPLATE_TYPE;

  let jobSettings = {};

  const outputTypeList = outputType.split(',');


  if (outputTypeList.length === 1) {
    if (outputTypeList[0] === 'HLS') {
      hlsJobSettings.OutputGroups[0].OutputGroupSettings.HlsGroupSettings.Destination = `s3://${outputBucketName}/${FileName}/`;
      hlsJobSettings.Inputs[0].FileInput = `s3://${Bucket}/${decodeURIComponent(AddedKey.replace(/\+/g, ' '))}`;
      jobSettings = hlsJobSettings;
    } else if (outputTypeList[0] === 'DASH') {
      dashJobSettings.OutputGroups[0].OutputGroupSettings.DashIsoGroupSettings.Destination = `s3://${outputBucketName}/${FileName}/`;
      dashJobSettings.Inputs[0].FileInput = `s3://${Bucket}/${decodeURIComponent(AddedKey.replace(/\+/g, ' '))}`;
      jobSettings = dashJobSettings;
    }
  } else {
    for (let counter = 0; counter < outputTypeList.length; counter++) {
      if (outputTypeList[counter] === 'HLS') {
        // iterate through the outputGroups and set the appropriate output file paths
        const outputGroupsLengths = hlsdashJobSettings.OutputGroups.length;

        for (let outputGroupsLengthsCounter = 0;
          outputGroupsLengthsCounter < outputGroupsLengths; outputGroupsLengthsCounter++) {
          if (hlsdashJobSettings.OutputGroups[outputGroupsLengthsCounter].OutputGroupSettings.Type.includes('HLS')) {
            hlsdashJobSettings.OutputGroups[outputGroupsLengthsCounter].OutputGroupSettings.HlsGroupSettings.Destination = `s3://${outputBucketName}/${FileName}/${hlsRendition}/`;
          }
        }
      }

      if (outputTypeList[counter] === 'DASH') {
        // iterate through the outputGroups and set the appropriate output file paths
        const outputGroupsLengths = hlsdashJobSettings.OutputGroups.length;

        for (let outputGroupsLengthsCounter = 0;
          outputGroupsLengthsCounter < outputGroupsLengths; outputGroupsLengthsCounter++) {
          if (hlsdashJobSettings.OutputGroups[outputGroupsLengthsCounter].OutputGroupSettings.Type.includes('DASH')) {
            hlsdashJobSettings.OutputGroups[outputGroupsLengthsCounter].OutputGroupSettings.DashIsoGroupSettings.Destination = `s3://${outputBucketName}/${FileName}/${dashRendition}/`;
          }
        }
      }
    }

    hlsdashJobSettings.Inputs[0].FileInput = `s3://${Bucket}/${decodeURIComponent(AddedKey.replace(/\+/g, ' '))}`;

    jobSettings = hlsdashJobSettings;
  }


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

  const jobParams = {
    JobTemplate: process.env.ARN_TEMPLATE,
    Queue: queueARN,
    UserMetadata: {},
    Role: process.env.MC_ROLE,
    Settings: jobSettings,
    Tags: { 'amplify-video': 'amplify-video' },
  };
  await mcClient.createJob(jobParams).promise();
}
