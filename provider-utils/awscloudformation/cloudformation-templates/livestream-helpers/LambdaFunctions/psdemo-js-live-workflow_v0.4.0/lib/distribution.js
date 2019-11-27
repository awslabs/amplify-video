/* eslint-disable global-require */
/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/no-unresolved */
/* eslint-disable no-console */
/* eslint-disable class-methods-use-this */

const AWS = require('aws-sdk');
const FS = require('fs');
const URL = require('url');
const PATH = require('path');
const { mxStoreResponse } = require('./mxStoreResponse');

const TMPL_PATH = PATH.join(__dirname, '../resources/cloudfront');
const TMPL_SUFFIX = '.template.json';

const PS_PARAMS = [
  'PS_CHANNEL_ID',
  'PS_DISTRIBUTION_ID',
];

const PS_ENDPOINTS = [
  'PS_PRIMARY_HLS_URL',
  'PS_PRIMARY_DASH_URL',
  'PS_PRIMARY_MSS_URL',
  'PS_PRIMARY_CMAF_URL',
];

/**
  * @class Distribution
  *
  */
class Distribution extends mxStoreResponse(class {}) {
  constructor(event, context) {
    super();
    this.$event = null;
    this.$context = null;
    this.$instance = null;
    this.initialize(event, context);
  }

  initialize(event, context) {
    try {
      this.$event = event;
      this.$context = context;
      /* sanity check */
      if (!this.$event.RequestType) {
        throw new Error('missing event.RequestType');
      }
      const missing = PS_PARAMS.filter(x => this.$event.ResourceProperties[x] === undefined);
      if (missing.length) {
        throw new Error(`event.ResourceProperties missing ${missing.join(', ')}`);
      }
      /* collect all the endpoints */
      this.$endpoints = PS_ENDPOINTS.map((x) => {
        const url = URL.parse(this.$event.ResourceProperties[x]);
        return (url.protocol && url) || undefined;
      }).filter(x => !!(x));
      this.$instance = new AWS.CloudFront({ apiVersion: '2017-03-25' });
    } catch (e) {
      throw e;
    }
  }

  get event() { return this.$event; }

  get resourceProperties() { return this.$event.ResourceProperties; }

  get context() { return this.$context; }

  get requestType() { return this.$event.RequestType; }

  get endpoints() { return this.$endpoints; }

  get channelId() { return this.$event.ResourceProperties.PS_CHANNEL_ID; }

  get distributionId() { return this.$event.ResourceProperties.PS_DISTRIBUTION_ID; }

  get cloudFront() { return this.$instance; }

  isRequestType(type) {
    return this.requestType.toLowerCase() === type;
  }

  static loadJsonTemplate(template) {
    return JSON.parse(FS.readFileSync(PATH.join(TMPL_PATH, `${template}${TMPL_SUFFIX}`)));
  }

  fillOrigins() {
    const template = Distribution.loadJsonTemplate('origin');
    const params = {};
    params.Items = [];
    const origins = Array.from(new Set(this.endpoints.map(x => x.hostname)));
    origins.forEach((x) => {
      const item = Object.assign({}, template);
      item.DomainName = x;
      item.Id = `origin-${x}`;
      params.Items.push(item);
    });
    params.Quantity = params.Items.length;
    if (!params.Quantity) {
      throw new Error('failed to create Origin block');
    }
    return params;
  }

  fillDefaultCacheBehavior(origins) {
    const params = Distribution.loadJsonTemplate('cacheBehavior');
    delete params.PathPattern;
    params.TargetOriginId = origins.Items[0].Id;
    return params;
  }

  fillCacheBehaviors(origins) {
    const template = Distribution.loadJsonTemplate('cacheBehavior');
    const params = {};
    params.Items = [];

    this.endpoints.forEach((url) => {
      const origin = origins.Items.find(x => x.DomainName === url.hostname);
      if (!origin) {
        throw new Error(`missing origin, ${url.hostname}`);
      }

      const item = Object.assign({}, template);
      /* eslint-disable prefer-const */
      let { dir: pathPattern, base } = PATH.parse(url.pathname);
      /* eslint-enable prefer-const */
      let smoothStreaming = false;

      if (base.toLowerCase() === 'manifest') {
        /* special handling for MSS */
        smoothStreaming = true;
        /* remove index.ism from path as well */
        pathPattern = PATH.parse(pathPattern).dir;
      }
      item.TargetOriginId = origin.Id;
      item.PathPattern = PATH.join(pathPattern, '*');
      item.SmoothStreaming = smoothStreaming;
      params.Items.push(item);
    });
    params.Quantity = params.Items.length;
    if (!params.Quantity) {
      throw new Error('failed to create CacheBehavior block');
    }
    return params;
  }

  async getDistribution() {
    const response = await this.cloudFront.getDistributionConfig({
      Id: this.distributionId,
    }).promise();
    return response;
  }

  async updateConfig(params) {
    const modified = Object.assign({}, params);
    try {
      modified.Id = this.distributionId;
      if (modified.ETag) {
        modified.IfMatch = modified.ETag;
        delete modified.ETag;
      }
      const { DistributionConfig: x } = modified;
      x.Origins = this.fillOrigins();
      x.DefaultCacheBehavior = this.fillDefaultCacheBehavior(x.Origins);
      x.CacheBehaviors = this.fillCacheBehaviors(x.Origins);
    } catch (e) {
      throw e;
    }
    return modified;
  }

  async updateDistribution(params) {
    const response = await this.cloudFront.updateDistribution(params).promise();
    const missing = [
      'Id', 'DomainName',
    ].filter(x => response.Distribution[x] === undefined);
    if (missing.length) {
      throw new Error(`response.Distribution missing ${missing.join(', ')}`);
    }
    return response;
  }

  replaceUrl(key, host) {
    const url = URL.parse(this.resourceProperties[key]);
    if (!url.protocol) {
      return this.resourceProperties[key];
    }
    url.host = host;
    return URL.format(url);
  }

  async create() {
    let response;
    response = await this.getDistribution();
    response = await this.updateConfig(response);
    response = await this.updateDistribution(response);

    const {
      Distribution: { Id, DomainName },
    } = response;

    const map = {
      PrimaryHlsUrl: 'PS_PRIMARY_HLS_URL',
      PrimaryDashUrl: 'PS_PRIMARY_DASH_URL',
      PrimaryMssUrl: 'PS_PRIMARY_MSS_URL',
      PrimaryCmafUrl: 'PS_PRIMARY_CMAF_URL',
    };

    Object.keys(map).forEach((k) => {
      this.storeResponseData(k, this.replaceUrl(map[k], DomainName));
    });
    this.storeResponseData('DomainName', DomainName);
    this.storeResponseData('DistributionId', Id);

    console.log(JSON.stringify(this.responseData, null, 2));
    return this.responseData;
  }

  async purge() {
    return this.responseData;
  }

  async entry() {
    try {
      const response = this.isRequestType('delete')
        ? await this.purge()
        : await this.create();
      return response;
    } catch (e) {
      throw e;
    }
  }
}

module.exports.Distribution = Distribution;
