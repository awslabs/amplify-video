/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/no-unresolved */
/* eslint-disable no-console */
const URL = require('url');
const HTTPS = require('https');

const SUCCESS = 'SUCCESS';
const FAILED = 'FAILED';

/**
 * @class CloudFormationResponse
 */
class CloudFormationResponse {
  constructor(event, context) {
    this.$event = null;
    this.$context = null;
    this.$initError = null;
    this.initialize(event, context);
  }

  initialize(event, context) {
    try {
      this.$event = event;
      this.$context = context;
      /* sanity check on the response */
      let missing = [
        'StackId', 'RequestId', 'ResponseURL', 'LogicalResourceId',
      ].filter(x => this.$event[x] === undefined);
      if (missing.length) {
        throw new Error(`event missing ${missing.join(', ')}`);
      }
      missing = ['logStreamName'].filter(x => this.$context[x] === undefined);
      if (missing.length) {
        throw new Error(`context missing ${missing.join(', ')}`);
      }
    } catch (e) {
      throw e;
    }
  }

  get event() { return this.$event; }

  get context() { return this.$context; }

  get stackId() { return this.event.StackId; }

  get requestId() { return this.event.RequestId; }

  get responseUrl() { return this.event.ResponseURL; }

  get logicalResourceId() { return this.event.LogicalResourceId; }

  get logStreamName() { return this.context.logStreamName; }

  isUnitTest() {
    return !!(this.event.ResourceProperties.PS_UNIT_TEST);
  }

  static parseResponseData(data) {
    if (data instanceof Error) {
      return [
        FAILED,
        {
          Error: data.message,
          Stack: data.stack,
          StatusCode: data.StatusCode || 500,
        },
      ];
    }
    return [SUCCESS, data];
  }

  async send(data, physicalResourceId) {
    return new Promise((resolve, reject) => {
      const [
        responseStatus,
        responseData,
      ] = CloudFormationResponse.parseResponseData(data);
      console.log(`parseResponseData = ${JSON.stringify({ responseStatus, responseData }, null, 2)}`);

      /* TODO: remove the testing code */
      if (this.isUnitTest()) {
        resolve(responseData);
        return;
      }

      const responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: `See details in CloudWatch Log Stream: ${this.logStreamName}`,
        PhysicalResourceId: physicalResourceId || this.logStreamName,
        StackId: this.stackId,
        RequestId: this.requestId,
        LogicalResourceId: this.logicalResourceId,
        Data: responseData,
      });

      let result = '';
      const url = URL.parse(this.responseUrl);
      const params = {
        hostname: url.hostname,
        port: 443,
        path: url.path,
        method: 'PUT',
        headers: {
          'Content-Type': '',
          'Content-Length': responseBody.length,
        },
      };

      const request = HTTPS.request(params, (response) => {
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          result += chunk.toString();
        });
        response.on('end', () => {
          if (response.statusCode >= 400) {
            const e = new Error(`${params.method} ${url.path} ${response.statusCode}`);
            e.statusCode = response.statusCode;
            reject(e);
          } else {
            resolve(result);
          }
        });
      });

      request.once('error', (e) => {
        e.message = `${params.method} ${url.path} - ${e.message}`;
        reject(e);
      });
      if (responseBody.length > 0) {
        request.write(responseBody);
      }
      request.end();
    });
  }
}

module.exports.CloudFormationResponse = CloudFormationResponse;
