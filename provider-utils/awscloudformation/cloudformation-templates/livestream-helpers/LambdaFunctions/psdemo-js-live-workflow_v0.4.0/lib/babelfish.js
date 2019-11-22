/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/no-unresolved */
/* eslint-disable no-console */
/* eslint-disable */

const URL = require('url');
const { SSM, MediaPackage } = require('aws-sdk');
const { mxStoreResponse } = require('./mxStoreResponse');

const PS_PARAMS = [
  'PS_CHANNEL_ID',
  'PS_CHANNEL_DESC',
  'PS_INGEST_TYPE',
  'PS_ENDPOINTS',
  'PS_STARTOVER_WINDOW',
  'PS_GOP_SIZE_IN_SEC',
  'PS_GOP_PER_SEGMENT',
  'PS_SEGMENT_PER_PLAYLIST',
];

const REQUIRED_ENV = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
];

/* POLL every 2 seconds */
const POLL_INTERVAL = 2;

/**
  * @class Babelfish
  *
  */
class Babelfish extends mxStoreResponse(class {}) {
  constructor(event, context) {
    super();

    this.$event = undefined;
    this.$context = undefined;
    this.$instance = undefined;
    this.$endpoints = undefined;

    this.initialize(event, context);
  }

  /**
    * @function initialize
    *
    * @param {object} event
    * @param {object} context
    *
    */
  initialize(event, context) {
    try {
      this.$event = event;
      this.$context = context;
      /* sanity check */
      if (!this.$event.RequestType) {
        throw new Error('missing event.RequestType');
      }
      let missing = PS_PARAMS.filter(x => this.$event.ResourceProperties[x] === undefined);
      if (missing.length) {
        throw new Error(`event.ResourceProperties missing ${missing.join(', ')}`);
      }
      missing = REQUIRED_ENV.filter(x => process.env[x] === undefined);
      if (missing.length) {
        throw new Error(`process.env missing ${missing.join(', ')}`);
      }
      /* endpoints: HLS, DASH, MSS, CMAF */
      this.$endpoints = (this.$event.ResourceProperties.PS_ENDPOINTS || []).filter(x => x);
      /* babelfish instance */
      this.$instance = new MediaPackage({ apiVersion: '2017-10-12' });
    } catch (e) {
      throw e;
    }
  }

  get event() { return this.$event; }

  get context() { return this.$context; }

  get requestType() { return this.$event.RequestType; }

  get channelId() { return this.$event.ResourceProperties.PS_CHANNEL_ID; }

  get channelDescription() { return this.$event.ResourceProperties.PS_CHANNEL_DESC; }

  get ingestType() { return this.$event.ResourceProperties.PS_INGEST_TYPE; }

  get startoverWindowSeconds() {
    const { ResourceProperties: { PS_STARTOVER_WINDOW = 300 } } = this.$event;
    return Number.parseInt(PS_STARTOVER_WINDOW, 10);
  }
  get gopSizeInSec() {
    const { ResourceProperties: { PS_GOP_SIZE_IN_SEC = 1 } } = this.$event;
    return Number.parseInt(PS_GOP_SIZE_IN_SEC, 10);
  }
  get gopPerSegment() {
    const { ResourceProperties: { PS_GOP_PER_SEGMENT = 1 } } = this.$event;
    return Number.parseInt(PS_GOP_PER_SEGMENT, 10);
  }
  get segmentPerPlaylist() {
    const { ResourceProperties: { PS_SEGMENT_PER_PLAYLIST = 3 } } = this.$event;
    return Number.parseInt(PS_SEGMENT_PER_PLAYLIST, 10);
  }

  get segmentDurationSeconds() {
    return this.gopSizeInSec * this.gopPerSegment;
  }

  get playlistWindowSeconds() {
    return this.segmentPerPlaylist * this.segmentDurationSeconds;
  }

  get manifestWindowSeconds() {
    return this.playlistWindowSeconds;
  }

  get endpoints() { return this.$endpoints; }

  get ssmKey() { return `/mediapackage/${this.channelId}`; }

  get babelfish() { return this.$instance; }

  /**
    * @function isRequestType
    * @param {string} type
    */
  isRequestType(type) {
    return this.requestType.toLowerCase() === type;
  }

  /**
   * @function createChannel
   */
  async createChannel() {
    try {
      const response = await this.babelfish.createChannel({
        Id: this.channelId,
        Description: this.channelDescription,
      }).promise();

      console.log(`createChannel = ${JSON.stringify(response, null, 2)}`);
      /* sanity check on the response */
      let missing = ['Id', 'Arn', 'HlsIngest'].filter(x => response[x] === undefined);
      if (missing.length) {
        throw new Error(`createChannel.response missing ${missing.join(', ')}`);
      }
      const { HlsIngest: { IngestEndpoints = [] } } = response;
      if (!IngestEndpoints.length) {
        throw new Error('createChannel.response.HlsIngest.IngestEndpoints is empty');
      }
      missing = [];
      IngestEndpoints.forEach((endpoint) => {
        missing = missing.concat([
          'Password', 'Url', 'Username',
        ].filter(x => endpoint[x] === undefined));
      });
      if (missing.length) {
        throw new Error(`createChannel.response.HlsIngest.IngestEndpoints missing ${missing.join(', ')}`);
      }
      return response;
    } catch (e) {
      throw e;
    }
  }


  /**
    * @function writeToParameterStore
    * @param {Array} ingestEndpoints
    *
    */
  async writeToParameterStore(ingestEndpoints) {
    const secrets = [];
    const ssm = new SSM({ apiVersion: '2014-11-06' });
    const promises = ingestEndpoints.map((x, idx) => {
      const param = {
        Type: 'SecureString',
        Name: `${this.ssmKey}-${idx}`,
        Value: x.Password,
        Description: `${this.channelDescription}-${idx}`,
        Overwrite: false,
      };
      secrets.push(param);
      return ssm.putParameter(param).promise();
    });
    await Promise.all(promises);
    return secrets;
  }

  createHlsPackageParams() {
    const keyword = 'hls';
    return {
      ChannelId: this.channelId,
      Id: `${this.channelId.toLowerCase()}-${keyword}`,
      Description: `${keyword.toUpperCase()} for ${this.channelDescription}`,
      StartoverWindowSeconds: this.startoverWindowSeconds,
      HlsPackage: {
        AdMarkers: 'SCTE35_ENHANCED',
        SegmentDurationSeconds: this.segmentDurationSeconds,
        PlaylistWindowSeconds: this.playlistWindowSeconds,
      },
    };
  }

  createDashPackageParams() {
    const keyword = 'dash';
    const {
      segmentDurationSeconds: SegmentDurationSeconds,
      manifestWindowSeconds: ManifestWindowSeconds,
    } = this;

    // normalizing min. buffer / presentation delay / update period based on manifest window
    const normalized = Number.parseInt(((ManifestWindowSeconds / 1.5) + 0.5), 10);
    const MinBufferTimeSeconds = normalized + (normalized % 2);
    const MinUpdatePeriodSeconds = MinBufferTimeSeconds / 2;
    const SuggestedPresentationDelaySeconds = MinUpdatePeriodSeconds;

    return {
      ChannelId: this.channelId,
      Id: `${this.channelId.toLowerCase()}-${keyword}`,
      Description: `${keyword.toUpperCase()} for ${this.channelDescription}`,
      StartoverWindowSeconds: this.startoverWindowSeconds,
      DashPackage: {
        SegmentDurationSeconds,
        ManifestWindowSeconds,
        MinBufferTimeSeconds,
        MinUpdatePeriodSeconds,
        SuggestedPresentationDelaySeconds,
      },
    };
  }

  createMssPackageParams() {
    const keyword = 'mss';
    return {
      ChannelId: this.channelId,
      Id: `${this.channelId.toLowerCase()}-${keyword}`,
      Description: `${keyword.toUpperCase()} for ${this.channelDescription}`,
      StartoverWindowSeconds: this.startoverWindowSeconds,
      MssPackage: {
        SegmentDurationSeconds: this.segmentDurationSeconds,
        ManifestWindowSeconds: this.playlistWindowSeconds,
      },
    };
  }

  createCmafPackageParams() {
    const keyword = 'cmaf';
    return {
      ChannelId: this.channelId,
      Id: `${this.channelId.toLowerCase()}-${keyword}`,
      Description: `${keyword.toUpperCase()} for ${this.channelDescription}`,
      StartoverWindowSeconds: this.startoverWindowSeconds,
      CmafPackage: {
        SegmentDurationSeconds: this.segmentDurationSeconds,
        SegmentPrefix: this.channelId,
        HlsManifests: [{
          Id: keyword,
          PlaylistType: 'EVENT',
          IncludeIframeOnlyStream: false,
          AdMarkers: 'SCTE35_ENHANCED',
          PlaylistWindowSeconds: this.playlistWindowSeconds,
        }],
      },
    };
  }

  async createEndpoints() {
    const promises = this.endpoints.map((endpoint) => {
      let params;
      switch (endpoint.toLowerCase()) {
        case 'hls':
          params = this.createHlsPackageParams();
          break;
        case 'dash':
          params = this.createDashPackageParams();
          break;
        case 'mss':
          params = this.createMssPackageParams();
          break;
        case 'cmaf':
          params = this.createCmafPackageParams();
          break;
        default:
          console.log(`${endpoint} NOT IMPL`);
          params = undefined;
      }

      return (params !== undefined)
        ? this.babelfish.createOriginEndpoint(params).promise()
        : undefined;
    });
    const responses = await Promise.all(promises);
    /* even if package is not created, we still need to report it to CF */
    const initSettings = {
      HlsEndpoint: '',
      DashEndpoint: '',
      MssEndpoint: '',
      CmafEndpoint: '',
    };
    const results = responses.filter(x => x).reduce((acc, cur) => {
      const {
        Url, CmafPackage, DashPackage, HlsPackage, MssPackage,
      } = cur;
      acc.DomainEndpoint = acc.DomainEndpoint || new Set();
      acc.DomainEndpoint.add(URL.parse(Url).hostname);
      if (HlsPackage) {
        return Object.assign({}, acc, { HlsEndpoint: Url });
      }
      if (DashPackage) {
        return Object.assign({}, acc, { DashEndpoint: Url });
      }
      if (MssPackage) {
        return Object.assign({}, acc, { MssEndpoint: Url });
      }
      if (CmafPackage) {
        return Object.assign({}, acc, { CmafEndpoint: CmafPackage.HlsManifests[0].Url });
      }
      return acc;
    }, initSettings);
    /* serialize DomainName array */
    // results.DomainEndpoint = Array.from(results.DomainEndpoint).join(',');
    /**
     * CAUTION: AWS::CloudFront::Distribution could only take a single origin (string)
     * If we would need to support multiple origins, we might need to go with CustomResource!
     */
    const [DomainEndpoint] = Array.from(results.DomainEndpoint);
    results.DomainEndpoint = DomainEndpoint;
    return results;
  }

  /**
    * @function create
    * @desc createChannel > saveToParameterStore > createEndpoints
    *
    */
  async create() {
    /* create channel first */
    const response = await this.createChannel();
    const { Id, Arn, HlsIngest: { IngestEndpoints } } = response;
    this.storeResponseData('Id', Id);
    this.storeResponseData('Arn', Arn);
    /* store parameters as list, comma separator */
    ['Url', 'Username', 'Password'].forEach((k) => {
      this.storeResponseData(k, IngestEndpoints.map(x => x[k]).join(','));
    });
    /* create parameter store to store secret */
    const secrets = await this.writeToParameterStore(IngestEndpoints);
    this.storeResponseData('ParameterStoreKey', secrets.map(x => x.Name).join(','));

    /* create origin endpoints */
    const endpoints = await this.createEndpoints();
    Object.keys(endpoints).forEach(x => this.storeResponseData(x, endpoints[x]));

    console.log(`responseData = ${JSON.stringify(this.responseData, null, 2)}`);
    return this.responseData;
  }

  async listOrigins() {
    const response = await this.babelfish.listOriginEndpoints({
      ChannelId: this.channelId,
      MaxResults: 20,
    }).promise();
    return response;
  }

  async waitForDeletion(maxTries = 40) {
    /* eslint-disable no-unused-vars */
    const promise = new Promise((resolve, reject) => {
      const bindFn = this.listOrigins.bind(this);
      let tries = 0;

      const timer = setInterval(async () => {
        try {
          const { OriginEndpoints } = await bindFn();
          if (!OriginEndpoints.length || tries >= maxTries) {
            clearInterval(timer);
            resolve(OriginEndpoints.length === 0);
            return;
          }
          tries += 1;
        } catch (e) {
          clearInterval(timer);
          console.error(e);
          resolve(false);
        }
      }, POLL_INTERVAL * 1000);
    });
    /* eslint-enable no-unused-vars */
    return promise;
  }

  async deleteEndpoints() {
    const {
      OriginEndpoints,
    } = await this.listOrigins();
    console.log(`deleting endpoint Ids: ${OriginEndpoints.map(x => x.Id).join(', ')}`);
    const promises = OriginEndpoints.map(x => this.babelfish.deleteOriginEndpoint({ Id: x.Id }).promise());
    await Promise.all(promises);

    /* wait for deletion */
    const deleted = await this.waitForDeletion();
    return deleted;
  }

  async deleteChannel() {
    try {
      await this.babelfish.deleteChannel({
        Id: this.channelId,
      }).promise();
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async deleteParameterStore(ingestEndpoints) {
    try {
      const ssm = new SSM({ apiVersion: '2014-11-06' });
      const promises = ingestEndpoints.map((x, idx) => ssm.deleteParameter({
        Name: `${this.ssmKey}-${idx}`,
      }).promise());
      await Promise.all(promises);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async describeChannel() {
    const response = await this.babelfish.describeChannel({
      Id: this.channelId,
    }).promise();
    return response;
  }

  /**
    * @function purge
    * @desc  deleteEndpoints > deleteChannel > deleteParameterStore
    *
    */
  async purge() {
    let deleted;
    /* need to find out numbers of ingest endpoints */
    const { HlsIngest: { IngestEndpoints } } = await this.describeChannel();

    /* delete all endpoints first */
    deleted = await this.deleteEndpoints();
    this.storeResponseData('OriginEndpointDeleted', deleted);

    /**
     * if we fail to wait for endpoint to be deleted, we must
     * skip the channel deletion. Otherwise, it will fail for sure.
     */
    if (deleted) {
      deleted = await this.deleteChannel();
      this.storeResponseData('ChannelDeleted', deleted);
    }

    /* delete parameter store at last */
    deleted = await this.deleteParameterStore(IngestEndpoints);
    this.storeResponseData('ParameterStoreDeleted', deleted);

    console.log(`responseData = ${JSON.stringify(this.responseData, null, 2)}`);
    return this.responseData;
  }

  compareUpdates(obj1, obj2) {
    const result = {};
    let key = '';
    for (key in obj1) {
      if (typeof obj2[key] === 'object' && typeof obj1[key] === 'object') {
        if (this.arraysEqual(obj2[key], obj1[key])) {
          // Same array, no change needed
        } else {
          result[key] = obj2[key];
        }
      } else if (obj2[key] != obj1[key]) {
        result[key] = obj2[key];
      }
    }
    return result;
  }


  arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    arr1.sort();
    arr2.sort();
    for (let i = arr1.length; i--;) {
      if (arr1[i] !== arr2[i]) return false;
    }

    return true;
  }

  async update() {
    // first get existing endpoints

    const diff = this.compareUpdates(this.$event.OldResourceProperties, this.$event.ResourceProperties);
    if (Object.keys(diff).length === 0) {
      return 'Nothing has changed';
    }

    const response = await this.describeChannel();
    const {
      OriginEndpoints,
    } = await this.listOrigins();
    const { Id, Arn, HlsIngest: { IngestEndpoints } } = response;
    this.storeResponseData('Id', Id);
    this.storeResponseData('Arn', Arn);
    /* store parameters as list, comma separator */
    ['Url', 'Username', 'Password'].forEach((k) => {
      this.storeResponseData(k, IngestEndpoints.map(x => x[k]).join(','));
    });

    const streamsUp = OriginEndpoints.map(x => x.Id.replace(`${this.channelId.toLowerCase()}-`, '').toUpperCase());

    let promises = streamsUp.map((x) => {
      const location = diff.PS_ENDPOINTS.indexOf(x);
      let params;
      if (location >= 0) {
        // Update'
        switch (x.toLowerCase()) {
          case 'hls':
            params = this.createHlsPackageParams();
            break;
          case 'dash':
            params = this.createDashPackageParams();
            break;
          case 'mss':
            params = this.createMssPackageParams();
            break;
          case 'cmaf':
            params = this.createCmafPackageParams();
            break;
        }
        delete params.ChannelId;
        diff.PS_ENDPOINTS.splice(location, 1);
        return (params !== undefined)
          ? this.babelfish.updateOriginEndpoint(params).promise()
          : undefined;
      }
      // Delete
      return this.babelfish.deleteOriginEndpoint({ Id: `${this.channelId.toLowerCase()}-${x.toLowerCase()}` }).promise();
    });

    if (diff.PS_ENDPOINTS) {
      const createPromises = diff.PS_ENDPOINTS.map((endpoint) => {
        let params;
        switch (endpoint.toLowerCase()) {
          case 'hls':
            params = this.createHlsPackageParams();
            break;
          case 'dash':
            params = this.createDashPackageParams();
            break;
          case 'mss':
            params = this.createMssPackageParams();
            break;
          case 'cmaf':
            params = this.createCmafPackageParams();
            break;
          default:
            console.log(`${endpoint} NOT IMPL`);
            params = undefined;
        }
        return (params !== undefined)
          ? this.babelfish.createOriginEndpoint(params).promise()
          : undefined;
      });
      promises = promises.concat(createPromises);
    }
    const responses = await Promise.all(promises);

    /* even if package is not created, we still need to report it to CF */
    const initSettings = {
      HlsEndpoint: '',
      DashEndpoint: '',
      MssEndpoint: '',
      CmafEndpoint: '',
    };
    const results = responses.filter(x => Object.keys(x).length > 0).reduce((acc, cur) => {
      const {
        Url, CmafPackage, DashPackage, HlsPackage, MssPackage,
      } = cur;
      if (Object.keys(cur).length != 0) {

      }
      acc.DomainEndpoint = acc.DomainEndpoint || new Set();
      console.log(cur);
      acc.DomainEndpoint.add(URL.parse(Url).hostname);
      if (HlsPackage) {
        return Object.assign({}, acc, { HlsEndpoint: Url });
      }
      if (DashPackage) {
        return Object.assign({}, acc, { DashEndpoint: Url });
      }
      if (MssPackage) {
        return Object.assign({}, acc, { MssEndpoint: Url });
      }
      if (CmafPackage) {
        return Object.assign({}, acc, { CmafEndpoint: CmafPackage.HlsManifests[0].Url });
      }
      return acc;
    }, initSettings);
    /* serialize DomainName array */
    // results.DomainEndpoint = Array.from(results.DomainEndpoint).join(',');
    /**
     * CAUTION: AWS::CloudFront::Distribution could only take a single origin (string)
     * If we would need to support multiple origins, we might need to go with CustomResource!
     */
    const [DomainEndpoint] = Array.from(results.DomainEndpoint);
    results.DomainEndpoint = DomainEndpoint;

    this.storeResponseData('ParameterStoreKey', `${this.ssmKey}-0,${this.ssmKey}-1`);

    Object.keys(results).forEach(x => this.storeResponseData(x, results[x]));

    console.log(`responseData = ${JSON.stringify(this.responseData, null, 2)}`);
    return this.responseData;
  }

  /**
   * @function entry
   */
  async entry() {
    try {
      let response;
      switch (this.requestType.toLowerCase()) {
        case 'update':
          response = await this.update();
          break;
        case 'delete':
          response = await this.purge();
          break;
        default:
          response = await this.create();
          break;
      }
      return response;
    } catch (e) {
      throw e;
    }
  }
}


module.exports.Babelfish = Babelfish;
/* eslint-enable */
