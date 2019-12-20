
// Load the AWS SDK for Node.js
// eslint-disable-next-line import/no-extraneous-dependencies
/* eslint-disable */
const AWS = require('aws-sdk');
/* eslint-enable */
const jobSettings = require('./settings.json');
// Set the region

exports.handler = async (event) => {
  AWS.config.update({ region: event.awsRegion });
  const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
  // Object was deleted
  if (event.Records[0].eventName === 'ObjectRemoved:Delete') {
    // Grabbing Key name and Bucket name from event
    const DeletedKey = event.Records[0].s3.object.key;
    const split = DeletedKey.split('.')[0];
    const outputBucketName = process.env.OUTPUT_BUCKET;

    // Call S3 to obtain a list of the objects in the bucket
    const res = await s3.listObjectsV2({
      Bucket: outputBucketName,
      Prefix: split,
    }).promise();

    // Clean up response to submit to deleteObjects API
    if (res.Contents.length === 0) {
      return;
    }
    const objectsToDelete = res.Contents.map(x => ({ Key: x.Key }));
    // Delete the listed objects with prefix of the key that was deleted.
    await s3.deleteObjects({
      Bucket: outputBucketName,
      Delete: {
        Objects: objectsToDelete,
        Quiet: false,
      },
    }).promise();
  } else if (event.Records[0].eventName === 'ObjectCreated:Put') {
    await createJob(event.Records[0].s3);
    console.log('It was a create event');
  } else {
    console.log('Other Event');
  }
  const response = {
    statusCode: 200,
    body: JSON.stringify('Hello from Lambda!'),
  };
  return response;
};

// Function to submit job to Elemental MediaConvert
async function createJob(eventObject) {
  let mcClient = new AWS.MediaConvert();
  try {
    const endpoints = await mcClient.describeEndpoints().promise();
    // console.log(endpoints);
    AWS.config.mediaconvert = { endpoint: endpoints.Endpoints[0].Url };
    // Override so config applies
    mcClient = new AWS.MediaConvert();
  } catch (e) {
    return;
  }
  const queueParams = {
    Name: 'Default', /* required */
  };

  const AddedKey = eventObject.object.key;
  const Bucket = eventObject.bucket.name;
  const outputBucketName = process.env.OUTPUT_BUCKET;

  jobSettings.OutputGroups[0].OutputGroupSettings.HlsGroupSettings.Destination = `s3://${outputBucketName}/output`;
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
