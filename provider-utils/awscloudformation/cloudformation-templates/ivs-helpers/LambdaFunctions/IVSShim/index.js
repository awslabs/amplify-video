/* eslint-disable strict */
/* eslint-disable global-require */
/* eslint-disable */
const crypto = require('crypto');
const rp = require('request-promise-native');

const SigV4Utils = {
  sign(key, msg) {
    return crypto.createHmac('sha256', key).update(msg).digest().toString('hex');
  },
  sha256(msg) {
    return crypto.createHash('sha256').update(msg, 'utf8').digest().toString('hex');
  },
  getSignatureKey(key, dateStamp, regionName, serviceName) {
    const kDate = crypto.createHmac('sha256', `AWS4${key}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(regionName).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(serviceName).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    return kSigning;
  },
};

exports.handler = async (event, context) => {
  const config = event.ResourceProperties;
  let responseData = {};
  switch (event.RequestType) {
    case 'Create':
      responseData = await createIVS(config);
      break;
    case 'Delete':
      responseData = await deleteIVS(event, config);
      break;
    case 'Update':
      responseData = await updateIVS(event, config);
      break;
    default:
      console.log(`${event.RequestType} is not supported. No changes are applied`);
  }
  const response = await sendResponse(event, context, 'SUCCESS', responseData);
  console.log('CFN STATUS:: ', response, responseData);
};

async function createIVS(config) {
  const flattenResults = {};
  const results = await signAndRequest('POST', '/CreateChannel', config);
  flattenResults.arn = results.channel.arn;
  flattenResults.playbackUrl = results.channel.playbackUrl;
  flattenResults.streamKeyValue = results.streamKey.value;
  flattenResults.ingestURL = results.channel.ingestEndpoint;
  return flattenResults;
}

async function updateIVS(config) {
  console.log(config);
  return {};
}

async function deleteIVS(event, config) {
  const deleteRequest = {
    arn: event.PhysicalResourceId,
  };
  const results = await signAndRequest('POST', '/DeleteChannel', deleteRequest);
  if (results) {
    results.arn = event.PhysicalResourceId;
    results.message = 'Delete was successful';
    return results;
  }
  deleteRequest.message = 'Delete was successful';
  return deleteRequest;
}

async function signAndRequest(method, uriRaw, config) {
  const service = 'ivs';
  const region = process.env.AWS_REGION;
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const token = encodeURIComponent(process.env.AWS_SESSION_TOKEN);
  const algorithm = 'AWS4-HMAC-SHA256';
  const host = 'ivs.us-west-2.amazonaws.com';
  const canonicalUri = uriRaw;

  const now = new Date();
  const amzdate = `${now.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  const dateStamp = amzdate.split('T')[0];
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  let canonicalQuerystring = 'X-Amz-Algorithm=AWS4-HMAC-SHA256';
  canonicalQuerystring += `&X-Amz-Credential=${encodeURIComponent(`${accessKey}/${credentialScope}`)}`;
  canonicalQuerystring += `&X-Amz-Date=${amzdate}`;
  canonicalQuerystring += '&X-Amz-Expires=86400';
  canonicalQuerystring += `&X-Amz-Security-Token=${token}`;
  canonicalQuerystring += '&X-Amz-SignedHeaders=host';
  delete config.ServiceToken;

  const canonicalHeaders = `host:${host}\n`;
  const payloadHash = SigV4Utils.sha256(JSON.stringify(config));
  const canonicalRequest = `${method}\n${canonicalUri}\n${canonicalQuerystring}\n${canonicalHeaders}\nhost\n${payloadHash}`;

  const stringToSign = `${algorithm}\n${amzdate}\n${credentialScope}\n${SigV4Utils.sha256(canonicalRequest)}`;
  const signingKey = SigV4Utils.getSignatureKey(secretKey, dateStamp, region, service);
  const signature = SigV4Utils.sign(signingKey, stringToSign);

  canonicalQuerystring += `&X-Amz-Signature=${signature}`;
  const requestURL = `${host}${canonicalUri}?${canonicalQuerystring}`;
  const options = {
    method,
    uri: `https://${requestURL}`,
    body: config,
    json: true,
  };
  const urlReturn = await rp(options);
  console.log(urlReturn);

  return urlReturn;
}

async function sendResponse(event, context, responseStatus, responseData) {
  const responseBodyDictionary = {
    Status: responseStatus,
    Reason: `See the details in CloudWatch Log Stream: ${context.logStreamName}`,
    StackId: event.StackId,
    RequestId: event.RequestId,
    LogicalResourceId: event.LogicalResourceId,
    Data: responseData,
  };
  if (responseData !== undefined) {
    responseBodyDictionary.PhysicalResourceId = responseData.arn;
    responseBodyDictionary.Data = responseData;
  }

  const responseBody = JSON.stringify(responseBodyDictionary);

  console.log('RESPONSE BODY:\n', responseBody);

  const options = {
    method: 'PUT',
    uri: event.ResponseURL,
    body: responseBody,
    headers: {
      'content-type': '',
      'content-length': responseBody.length,
    },
  };
  const urlReturn = await rp(options);
  console.log('urlReturn: ', urlReturn);

  console.log('options: ', options);

  console.log('SENDING RESPONSE...\n');
  return urlReturn;
}
