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

  const jobParams = {
    JobTemplate: process.env.ARN_TEMPLATE,
    Queue: queueARN,
    UserMetadata: {},
    Role: process.env.MC_ROLE,
    Settings: jobSettings,
  };
  await mcClient.createJob(jobParams).promise();
}
