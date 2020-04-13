// Load the AWS SDK for Node.js
// eslint-disable-next-line import/no-extraneous-dependencies
/* eslint-disable */
const AWS = require('aws-sdk');
/* eslint-enable */
const jobSettings = require('./settings.json');
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
  try {
    const endpoints = await mcClient.describeEndpoints().promise();
    AWS.config.mediaconvert = { endpoint: endpoints.Endpoints[0].Url };
    // Override so config applies
    mcClient = new AWS.MediaConvert();
  } catch (e) {
    console.log(e);
    return;
  }

  const queueParams = {
    Name: 'Default', /* required */
  };
  const AddedKey = eventObject.object.key;
  // Get the name of the file passed in the event without the extension
  const FileName = AddedKey.split('.').slice(0, -1).join('.');
  // Get the extension of the file passed in the event
  const FileExtension = AddedKey.split('.').pop();
  const Bucket = eventObject.bucket.name;
  const outputBucketName = process.env.OUTPUT_BUCKET;

  // Set the output to have the filename (without extension) as a folder
  jobSettings.OutputGroups[0].OutputGroupSettings.HlsGroupSettings.Destination = `s3://${outputBucketName}/${FileName}/`;
  jobSettings.Inputs[0].FileInput = `s3://${Bucket}/${AddedKey}`;

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
  console.log(`Using queue:  ${queueARN}`);

  let templateARN = '';
  const templateARNEnvironmentVariable = `${FileExtension}_ARN_TEMPLATE`;
  console.log(`Reading template ARN from:  ${templateARNEnvironmentVariable}`);
  // Look for an environment variable named with the file extension
  if (process.env[templateARNEnvironmentVariable]) {
    // If found, use the template ARN stored in that variable
    templateARN = process.env[templateARNEnvironmentVariable];
  } else {
    // If not found, use the template ARN from the default variable
    templateARN = process.env.ARN_TEMPLATE;
  }
  console.log(`Using template:  ${templateARN}`);

  const jobParams = {
    JobTemplate: templateARN,
    Queue: queueARN,
    UserMetadata: {},
    Role: process.env.MC_ROLE,
    Settings: jobSettings,
  };
  await mcClient.createJob(jobParams).promise();
}
