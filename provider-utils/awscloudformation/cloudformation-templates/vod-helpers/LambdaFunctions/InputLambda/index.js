// Load the AWS SDK for Node.js
// eslint-disable-next-line import/no-extraneous-dependencies
/* eslint-disable */
const AWS = require('aws-sdk');
/* eslint-enable */
const jobSettings = require('./settings.json');
// Set the region

exports.handler = async (event) => {
  AWS.config.update({ region: event.awsRegion });
  if (event.Records[0].eventName === 'ObjectCreated:Put') {
    await createJob(event.Records[0].s3);
    const response = {
      statusCode: 200,
      body: JSON.stringify('Transcoding Your Files!'),
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
  const Bucket = eventObject.bucket.name;
  const outputBucketName = process.env.OUTPUT_BUCKET;

  jobSettings.OutputGroups[0].OutputGroupSettings.HlsGroupSettings.Destination = `s3://${outputBucketName}/output/`;
  jobSettings.Inputs[0].FileInput = `s3://${Bucket}/${AddedKey}`;

  const queue = mcClient.getQueue(queueParams).promise();
  const jobParams = {
    JobTemplate: process.env.ARN_TEMPLATE,
    Queue: queue.Arn,
    UserMetadata: {},
    Role: process.env.MC_ROLE,
    Settings: jobSettings,
  };
  await mcClient.createJob(jobParams).promise();
}
