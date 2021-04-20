/* eslint-disable */
const AWS = require('aws-sdk');
/* eslint-enable */
const s3 = new AWS.S3({});

/* eslint-disable */
exports.handler = function (event, context) {
/* eslint-enable */
  const config = event.ResourceProperties;

  const responseData = {};

  switch (event.RequestType) {
    case 'Create':
      createNotifications(config);
      break;
    case 'Update':
      createNotifications(config);
      break;
    case 'Delete':
      deleteNotifications(config);
      break;
    default:
      console.log('No changes');
  }

  const response = sendResponse(event, context, 'SUCCESS', responseData);
  console.log('CFN STATUS:: ', response);
};

function sendResponse(event, context, responseStatus, responseData) {
  const responseBody = JSON.stringify({
    Status: responseStatus,
    Reason: `See the details in CloudWatch Log Stream: ${context.logStreamName}`,
    PhysicalResourceId: context.logStreamName,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData,
  });

  console.log('RESPONSE BODY:\n', responseBody);

  const https = require('https');
  const url = require('url');

  const parsedUrl = url.parse(event.ResponseURL);
  const options = {
    hostname: parsedUrl.hostname,
    port: 443,
    path: parsedUrl.path,
    method: 'PUT',
    headers: {
      'content-type': '',
      'content-length': responseBody.length,
    },
  };

  console.log('SENDING RESPONSE...\n');

  const request = https.request(options, (response) => {
    console.log(`STATUS: ${response.statusCode}`);
    console.log(`HEADERS: ${JSON.stringify(response.headers)}`);
    // Tell AWS Lambda that the function execution is done
    context.done();
  });

  request.on('error', (error) => {
    console.log(`sendResponse Error:${error}`);
    // Tell AWS Lambda that the function execution is done
    context.done();
  });

  // write data to request body
  request.write(responseBody);
  request.end();
}

function createNotifications(config) {
  const LambdaFunctionConfig = [];

  Object.values(config.TriggerSuffix).forEach((suffix) => {
    const suffixConfigure = {
      Events: ['s3:ObjectCreated:*'],
      LambdaFunctionArn: config.IngestArn,
      Filter: {
        Key: {
          FilterRules: [{
            Name: 'suffix',
            Value: suffix,
          }],
        },
      },
    };
    LambdaFunctionConfig.push(suffixConfigure);
  });
  const params = {
    Bucket: config.BucketName,
    NotificationConfiguration: {
    },
  };
  params.NotificationConfiguration.LambdaFunctionConfigurations = LambdaFunctionConfig;

  s3.putBucketNotificationConfiguration(params, (err, data) => {
    if (err) console.log(err, err.stack);
    else console.log(data);
  });
}

function deleteNotifications(config) {
  console.log(config);
  // Do nothing for now
}
