/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/no-unresolved */
/* eslint-disable no-console */
/* eslint-disable */
const FS = require('fs');
const URL = require('url');
const PATH = require('path');
const { MediaLive } = require('aws-sdk');
const util = require('util');
const { mxStoreResponse } = require('./mxStoreResponse');

const PS_PARAMS = [
  'PS_CHANNEL_ID',
  'PS_INPUT_SECURITY_GROUP',
  'PS_INGEST_TYPE',
  'PS_ROLE_ARN',
  'PS_ENDPOINT_URLS',
  'PS_USERNAMES',
  'PS_PARAMETER_STORE_KEYS',
  // 'PS_MEDIASTORE_ENDPOINT',
  'PS_ENCODING_PROFILE',
  'PS_GOP_SIZE_IN_SEC',
  'PS_GOP_PER_SEGMENT',
  'PS_SEGMENT_PER_PLAYLIST',
  'PS_START_CHANNEL',
  'PS_MP4_URL',
];

const REQUIRED_ENV = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
];

/* POLL every 4 seconds */
const POLL_INTERVAL = 4;

/**
  * @class Flagfish
  *
  */
class Flagfish extends mxStoreResponse(class { }) {
  constructor(event, context) {
    super();

    this.$event = undefined;
    this.$context = undefined;
    this.$instance = undefined;
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

      const {
        ResourceProperties: {
          PS_ENDPOINT_URLS: urls,
          PS_USERNAMES: usernames,
          PS_PARAMETER_STORE_KEYS: storeKeys,
        },
      } = this.$event;
      /* mediapackage ingest points / usernames / parameter stores */
      this.$endpoints = (Array.isArray(urls) ? urls : urls.split(',')).filter(x => x);
      this.$usernames = (Array.isArray(usernames) ? usernames : usernames.split(',')).filter(x => x);
      this.$storeKeys = (Array.isArray(storeKeys) ? storeKeys : storeKeys.split(',')).filter(x => x);
      missing = [this.$endpoints, this.$usernames, this.$storeKeys].filter(x => x.length < 2);
      if (missing.length) {
        this.$endpoints = undefined;
      }

      /* optional */
      const {
        ResourceProperties: {
          PS_MEDIASTORE_ENDPOINT: msUrl,
        },
      } = this.$event;
      this.$mediastoreHost = (msUrl) ? URL.parse(msUrl).hostname : undefined;

      /* flagfish instance */
      this.$instance = new MediaLive({ apiVersion: '2017-10-14' });
    } catch (e) {
      throw e;
    }
  }

  get event() { return this.$event; }

  get context() { return this.$context; }

  get requestType() { return this.$event.RequestType; }

  get channelId() { return this.$event.ResourceProperties.PS_CHANNEL_ID; }

  get inputSecurityGroup() { return this.$event.ResourceProperties.PS_INPUT_SECURITY_GROUP; }

  get ingestType() { return this.$event.ResourceProperties.PS_INGEST_TYPE.toUpperCase(); }
  
  get mp4URL() { return this.$event.ResourceProperties.PS_MP4_URL; }

  get roleArn() { return this.$event.ResourceProperties.PS_ROLE_ARN; }

  get encodingProfile() { return this.$event.ResourceProperties.PS_ENCODING_PROFILE.toLowerCase(); }

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
    const x = Number.parseInt(PS_SEGMENT_PER_PLAYLIST, 10);
    return (x < 3) ? 3 : x;
  }

  get shouldStartChannel() {
    return this.$event.ResourceProperties.PS_START_CHANNEL.toUpperCase() === 'YES';
  }

  get primaryEndpoint() {
    return {
      Url: this.$endpoints[0],
      Username: this.$usernames[0],
      PasswordParam: this.$storeKeys[0],
    };
  }
  get backupEndpoint() {
    return {
      Url: this.$endpoints[1],
      Username: this.$usernames[1],
      PasswordParam: this.$storeKeys[1],
    };
  }

  get hasMediaPackage() {
    return this.$event.ResourceProperties.PS_ENDPOINT_URLS.length > 1;
  }

  /* BEGIN: MediaStore-specific */
  get mediastoreHost() {
    return this.$mediastoreHost;
  }

  get hasMediaStore() {
    return !!this.mediastoreHost;
  }

  get primaryMediaStoreIngestUrl() {
    if (!this.hasMediaStore) {
      return undefined;
    }
    return `mediastoressl://${this.mediastoreHost}/p/index`;
  }
  get backupMediaStoreIngestUrl() {
    if (!this.hasMediaStore) {
      return undefined;
    }
    return `mediastoressl://${this.mediastoreHost}/b/index`;
  }
  get primaryMediaStoreEgressUrl() {
    if (!this.hasMediaStore) {
      return undefined;
    }
    return `https://${this.mediastoreHost}/p/index.m3u8`;
  }
  get backupMediaStoreEgressUrl() {
    if (!this.hasMediaStore) {
      return undefined;
    }
    return `https://${this.mediastoreHost}/b/index.m3u8`;
  }
  /* END: MediaStore-specific */
  get flagfish() { return this.$instance; }

  /**
   * @static
   * @function deepCopy
   * @param {object} obj - object to copy
   */
  static deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
    * @function isRequestType
    * @param {string} type
    *
    */
  isRequestType(type) {
    return this.requestType.toLowerCase() === type;
  }

  async createInputSecurityGroup(securityGroups) {
    const payload = {
      WhitelistRules: securityGroups.map(Cidr => ({ Cidr })),
    };
    const response = await this.flagfish.createInputSecurityGroup(payload).promise();
    /* sanity check */
    const missing = ['Id', 'Arn', 'WhitelistRules'].filter(x => response.SecurityGroup[x] === undefined);
    if (missing.length) {
      throw new Error(`response.SecurityGroup missing ${missing.join(', ')}`);
    }
    return response;
  }

  async createInput(securityGroupId) {
    const InputSecurityGroups = Array.isArray(securityGroupId)
      ? securityGroupId
      : [securityGroupId];
    const payload = {
      Name: `input-${this.channelId}`,
      Type: this.ingestType,
      InputSecurityGroups,
    };
    /* RTMP specifically needs StreamName to be set */
    if (this.ingestType === 'RTMP_PUSH') {
      payload.Destinations = ['p', 'b'].map(x => ({ StreamName: `${this.channelId}-${x}` }));
    }
     /* Set MediaLive input Source as the Url to MP4 file*/
    if (this.ingestType === 'MP4_FILE') {
      payload.Sources =  [{ Url: this.mp4URL }, {Url: this.mp4URL}];
    }

    const response = await this.flagfish.createInput(payload).promise();
    const { Input } = response;
    const missing = ['Id', 'Arn', 'Name', 'Destinations'].filter(x => Input[x] === undefined);
    if (missing.length) {
      throw new Error(`response.Input missing ${missing.join(', ')}`);
    }
    if (this.ingestType === 'MP4_FILE') {
      /* Just return when it is MP4_FILE */
      return response;
    }
    const { Destinations } = Input;
    if (Destinations.length < 2) {
      throw new Error(`invalid input destination counts: (${Destinations.length})`);
    }
    return response;
  }

  /**
   * @function updateEncodingSettings
   * @description update encoding settings based on GOP size and GOP per segment settings
   * @param {object} payload - job json object
   */
  updateEncodingSettings(payload) {
    const {
      EncoderSettings: {
        OutputGroups, VideoDescriptions,
      },
    } = payload;

    const segmentLength = this.gopSizeInSec * this.gopPerSegment;
    OutputGroups.forEach((outputGroup) => {
      const { OutputGroupSettings: { HlsGroupSettings } } = outputGroup;
      HlsGroupSettings.SegmentLength = segmentLength;
      HlsGroupSettings.IndexNSegments = this.segmentPerPlaylist;
    });
    VideoDescriptions.forEach((videoDesc) => {
      const {
        Width, Height, CodecSettings: { H264Settings },
      } = videoDesc;
      /* if segmentLength is 1s, force IP frame only */
      if (segmentLength === 1) {
        H264Settings.GopNumBFrames = 0;
        /* force framerate to be integer to workaround misalignment of segment length */
        H264Settings.FramerateDenominator = 1000;
      } else {
        H264Settings.GopNumBFrames = 2;
      }
      /* for low resolution, don't use B-frame */
      if ((Width * Height) < (640 * 360)) {
        H264Settings.GopNumBFrames = 0;
      }
      const fps = H264Settings.FramerateNumerator / H264Settings.FramerateDenominator;
      H264Settings.GopSize = Math.ceil(fps) * this.gopSizeInSec;
    });
  }

  /**
    * @function configureDestinations
    *
    */
  configureDestinations(payload) {
    /* eslint-disable no-param-reassign */
    const params = {};

    if (this.$event.ResourceProperties.PS_ENDPOINT_URLS.length < 1) {
      return;
    }

    params.Id = `destination-${this.channelId}`;
    params.Settings = [];
    params.Settings.push(this.primaryEndpoint);
    params.Settings.push(this.backupEndpoint);
    payload.Destinations = [];
    payload.Destinations.push(params);
    payload.EncoderSettings.OutputGroups.forEach((og) => {
      og.OutputGroupSettings.HlsGroupSettings.Destination.DestinationRefId = params.Id;
    });
    /* update output group destination reference */

    /* eslint-enable no-param-reassign */
  }

  /**
   * @function addMediaStoreOutputGroup
   * @description add mediastore destination, duplicate hls output group
   * @param {object} payload - json job
   */
  addMediaStoreOutputGroup(payload) {
    if (!this.hasMediaStore) {
      return;
    }
    /* eslint-disable no-param-reassign */
    const prefix = 'ms-';

    const {
      Destinations,
      EncoderSettings: {
        AudioDescriptions, CaptionDescriptions, VideoDescriptions, OutputGroups,
      },
    } = payload;

    /* adding mediatstore destination */
    Destinations.push({
      Id: `${prefix}destination-${this.channelId}`,
      Settings: [
        this.primaryMediaStoreIngestUrl, this.backupMediaStoreIngestUrl,
      ].map(Url => ({ Url })),
    });

    /**
     * ATTENTION:
     * The logic below assumes the job json only contains HLS output group. It it contains
     * other output group such as archive, we need to selectively clone the outputs!
     */
    /* clone all audio, caption, video descriptions  */
    [
      AudioDescriptions,
      CaptionDescriptions,
      VideoDescriptions,
    ].forEach((descriptions) => {
      Flagfish.deepCopy(descriptions).forEach((x) => {
        x.Name = `${prefix}${x.Name}`;
        descriptions.push(x);
        if (!this.hasMediaPackage) {
          descriptions.shift();
        }
      });
    });
    /* clone HLS output group and modify to mediastore */
    const clonedOG = Flagfish.deepCopy(OutputGroups.find(x => !!(x.OutputGroupSettings.HlsGroupSettings)));

    clonedOG.Name = `${prefix}${clonedOG.Name}`;
    const {
      OutputGroupSettings: { HlsGroupSettings },
      Outputs,
    } = clonedOG;
    HlsGroupSettings.HlsCdnSettings = {
      HlsMediaStoreSettings: {
        NumRetries: 10,
        ConnectionRetryInterval: 1,
        RestartDelay: 15,
        FilecacheDuration: 300,
        MediaStoreStorageClass: 'TEMPORAL',
      },
    };
    HlsGroupSettings.Destination.DestinationRefId = `${prefix}destination-${this.channelId}`;
    Outputs.forEach((x) => {
      if (x.VideoDescriptionName) {
        x.VideoDescriptionName = `${prefix}${x.VideoDescriptionName}`;
      }
      if (x.AudioDescriptionNames) {
        x.AudioDescriptionNames = x.AudioDescriptionNames.map(a => `${prefix}${a}`);
      }
      if (x.CaptionDescriptionNames) {
        x.CaptionDescriptionNames = x.CaptionDescriptionNames.map(a => `${prefix}${a}`);
      }
    });
    OutputGroups.push(clonedOG);
    if (!this.hasMediaPackage) {
      OutputGroups.shift();
    }
    console.log(util.inspect(payload, { showHidden: false, depth: null }));
    /* eslint-enable no-param-reassign */
  }

  async createChannel(inputId) {
    try {
      const template = PATH.join(__dirname, `../resources/${this.encodingProfile}.json`);
      const payload = JSON.parse(FS.readFileSync(template));
      payload.Name = this.channelId;
      payload.RoleArn = this.roleArn;
      payload.InputAttachments[0].InputId = inputId;

      this.updateEncodingSettings(payload);
      this.configureDestinations(payload); // Add if statement for check if destination has mediapackage
      this.addMediaStoreOutputGroup(payload);
      if (this.ingestType === "MP4_FILE") {
        payload.InputAttachments[0].InputSettings.NetworkInputSettings = null;
        payload.InputAttachments[0].InputSettings.SourceEndBehavior = "LOOP";
      }
      const response = await this.flagfish.createChannel(payload).promise(); // Should work
      /* sanity check */
      const missing = ['Id', 'Arn', 'Name'].filter(x => response.Channel[x] === undefined);
      if (missing.length) {
        throw new Error(`response.Channel missing ${missing.join(', ')}`);
      }
      return response;
    } catch (e) {
      throw e;
    }
  }

  async describeChannel(ChannelId) {
    const response = await this.flagfish.describeChannel({ ChannelId }).promise();
    return response;
  }

  async waitForChannel(ChannelId, maxTries = 40) {
    /* eslint-disable no-unused-vars */
    const promise = new Promise((resolve, reject) => {
      const bindFn = this.describeChannel.bind(this);
      let tries = 0;

      const timer = setInterval(async () => {
        try {
          const { State } = await bindFn(ChannelId);
          const ready = (State && State.toUpperCase() === 'IDLE');
          if (ready || tries >= maxTries) {
            clearInterval(timer);
            resolve(ready);
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

  async startChannel(ChannelId) {
    if (!this.shouldStartChannel) {
      return false;
    }
    /**
     * Do our best to wait for the channel to be created.
     * If it takes too long, skip the channel start logic.
     */
    const canStart = await this.waitForChannel(ChannelId);
    if (!canStart) {
      console.log(`Waited 2min. Channel ${ChannelId} not ready to start. Skipping...`);
      return false;
    }
    await this.flagfish.startChannel({ ChannelId }).promise();
    return true;
  }

  async create() {
    let response;
    /* First, create security group */
    response = await this.createInputSecurityGroup(this.inputSecurityGroup);
    const {
      SecurityGroup: { Id: securityGroupId },
    } = response;
    this.storeResponseData('InputSecurityGroupId', securityGroupId);

    /* Next, create input */
    response = await this.createInput(securityGroupId);
    const {
      Input: {
        Id: InputId,
        Name: InputName,
        Type: InputType,
        Destinations,
      },
    } = response;
    this.storeResponseData('InputId', InputId);
    this.storeResponseData('InputName', InputName);
    this.storeResponseData('InputType', InputType);
    if (this.ingestType === "MP4_FILE") {
      this.storeResponseData('PrimaryIngestUrl', this.mp4URL);
      this.storeResponseData('BackupIngestUrl', this.mp4URL);
    } else { 
      this.storeResponseData('PrimaryIngestUrl', Destinations[0].Url);
      this.storeResponseData('BackupIngestUrl', Destinations[1].Url);
    }

    /* Next, create channel */
    response = await this.createChannel(InputId);
    const {
      Channel: {
        Id: ChannelId,
        Name: ChannelName,
      },
    } = response;
    this.storeResponseData('ChannelId', ChannelId);
    this.storeResponseData('ChannelName', ChannelName);
    if (this.primaryMediaStoreEgressUrl) {
      this.storeResponseData('PrimaryMediaStoreEgressUrl', this.primaryMediaStoreEgressUrl);
    }
    if (this.backupMediaStoreEgressUrl) {
      this.storeResponseData('BackupMediaStoreEgressUrl', this.backupMediaStoreEgressUrl);
    }
    /* At last, start the channel */
    await this.startChannel(ChannelId);

    console.log(JSON.stringify(this.responseData, null, 2));
    return this.responseData;
  }

  async findChannelByName(channelName) {
    try {
      const { Channels } = await this.flagfish.listChannels({
        MaxResults: 20,
      }).promise();
      return Channels.find(x => x.Name === channelName);
    } catch (e) {
      console.error(e);
      return undefined;
    }
  }

  async stopChannel(ChannelId) {
    try {
      await this.flagfish.stopChannel({
        ChannelId,
      }).promise();
      /* wait for channel to fully stop */
      const stopped = await this.waitForChannel(ChannelId, 45);
      if (!stopped) {
        console.log(`Waited 3min. Channel ${ChannelId} not stopping. Skipping...`);
        return false;
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async deleteChannel(ChannelId) {
    try {
      await this.flagfish.deleteChannel({
        ChannelId,
      }).promise();
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }

  async describeInput(InputId) {
    const response = await this.flagfish.describeInput({
      InputId,
    }).promise();
    return response;
  }

  async waitForInput(InputId, maxTries = 40) {
    /* eslint-disable no-unused-vars */
    const promise = new Promise((resolve, reject) => {
      const bindFn = this.describeInput.bind(this);
      let tries = 0;

      const timer = setInterval(async () => {
        try {
          const { State, SecurityGroups } = await bindFn(InputId);
          const ready = (State && State.toUpperCase() === 'DETACHED');
          if (ready || tries >= maxTries) {
            clearInterval(timer);
            resolve(SecurityGroups);
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

  async deleteInput(InputId) {
    const response = await this.waitForInput(InputId);
    /* input not fully detached, skip deleting the input */
    if (response === false) {
      return false;
    }
    const InputSecurityGroupIds = Array.isArray(response)
      ? response
      : [response];

    /* now, delete the input */
    await this.flagfish.deleteInput({ InputId }).promise();

    /* and delete InputSecurityGroup */
    const promises = InputSecurityGroupIds.map(InputSecurityGroupId => this.flagfish.deleteInputSecurityGroup({
      InputSecurityGroupId,
    }).promise());
    await Promise.all(promises);
    return true;
  }

  async deleteInputs(InputIds) {
    try {
      const promises = InputIds.map(InputId => this.deleteInput(InputId));
      const responses = await Promise.all(promises);
      return responses.map(x => x === true).length;
    } catch (e) {
      console.error(e);
      return 0;
    }
  }

  async purge() {
    let response;

    /* First, find the right channel by name */
    const channel = await this.findChannelByName(this.channelId) || {};
    const { Id: ChannelId } = channel;
    if (!ChannelId) {
      this.storeResponseData('ChannelDeleted', false);
      return this.responseData;
    }

    /* Next, stop the channel */
    response = await this.stopChannel(ChannelId);
    if (!response) {
      this.storeResponseData('ChannelDeleted', false);
      return this.responseData;
    }

    /* Now, delete channel */
    response = await this.deleteChannel(ChannelId);
    this.storeResponseData('ChannelDeleted', ChannelId);

    /* Next, delete all inputs */
    const { InputAttachments } = channel;
    const inputIds = InputAttachments.map(x => x.InputId);
    response = await this.deleteInputs(inputIds);
    if (response !== InputAttachments.length) {
      console.log(`not all input resources are removed, ${response}/${InputAttachments.length}`);
      this.storeResponseData('InputsDeleted', response);
      return this.responseData;
    }
    this.storeResponseData('InputsDeleted', inputIds.join(','));

    console.log(JSON.stringify(this.responseData, null, 2));
    return this.responseData;
  }
  /*
   * @function compareUpdates
   * obj1 - old param
   * obj2 - new param
   */
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
    let response;

    const diff = this.compareUpdates(this.$event.OldResourceProperties, this.$event.ResourceProperties);
    console.log(diff);
    if (Object.keys(diff).length === 0) {
      return 'Nothing has changed';
    }
    const channel = await this.findChannelByName(this.channelId) || {};
    const { Id: ChannelId } = channel;
    const inputParam = {
      InputId: channel.InputAttachments[0].InputId,
    };
    const currentInput = await this.flagfish.describeInput(inputParam).promise();
    const inputId = channel.InputAttachments[0].InputId;
    if (diff.PS_INGEST_TYPE) {
      this.purge();
      this.create();
      return;
    }

    if (diff.PS_INPUT_SECURITY_GROUP) {
      const inputSecurityParam = {
        InputSecurityGroupId: currentInput.SecurityGroups[0],
        WhitelistRules: diff.PS_INPUT_SECURITY_GROUP.map(Cidr => ({ Cidr })),
      };
      const currentStuff = await this.flagfish.updateInputSecurityGroup(inputSecurityParam).promise();
      console.log(currentStuff);
      delete diff.PS_INPUT_SECURITY_GROUP;
      // We will need to return stuff but we will work on it.
    }

    if (diff.PS_ENDPOINT_URLS || diff.PS_MEDIASTORE_ENDPOINT) {
      const {
        ResourceProperties: {
          PS_ENDPOINT_URLS: urls,
          PS_USERNAMES: usernames,
          PS_PARAMETER_STORE_KEYS: storeKeys,
        },
      } = this.$event;
      /* mediapackage ingest points / usernames / parameter stores */

      this.$endpoints = (Array.isArray(urls) ? urls : urls.split(',')).filter(x => x);
      this.$usernames = (Array.isArray(usernames) ? usernames : usernames.split(',')).filter(x => x);
      this.$storeKeys = (Array.isArray(storeKeys) ? storeKeys : storeKeys.split(',')).filter(x => x);

      /* optional */
      const {
        ResourceProperties: {
          PS_MEDIASTORE_ENDPOINT: msUrl,
        },
      } = this.$event;
      this.$mediastoreHost = (msUrl) ? URL.parse(msUrl).hostname : undefined;
    }

    if (Object.keys(diff).length > 1 || (Object.keys(diff).length > 0 && !diff.PS_START_CHANNEL)) {
      response = await this.stopChannel(ChannelId);
      if (!response) {
        this.storeResponseData('ChannelStop', false);
        return this.responseData;
      }
      try {
        const template = PATH.join(__dirname, `../resources/${this.encodingProfile}.json`);
        const payload = JSON.parse(FS.readFileSync(template));
        payload.Name = this.channelId;
        payload.RoleArn = this.roleArn;
        payload.InputAttachments[0].InputId = inputId;
        payload.ChannelId = channel.Id;

        this.updateEncodingSettings(payload);
        this.configureDestinations(payload); // Add if statement for check if destination has mediapackage
        this.addMediaStoreOutputGroup(payload);
        const response = await this.flagfish.updateChannel(payload).promise();
        /* sanity check */
        const missing = ['Id', 'Arn', 'Name'].filter(x => response.Channel[x] === undefined);
        if (missing.length) {
          throw new Error(`response.Channel missing ${missing.join(', ')}`);
        }
      } catch (e) {
        throw e;
      }
    }

    this.storeResponseData('InputSecurityGroupId', currentInput.SecurityGroups[0]);
    this.storeResponseData('InputId', currentInput.Id);
    this.storeResponseData('InputName', currentInput.Name);
    this.storeResponseData('InputType', currentInput.Type);
    this.storeResponseData('PrimaryIngestUrl', currentInput.Destinations[0].Url);
    this.storeResponseData('BackupIngestUrl', currentInput.Destinations[1].Url);
    this.storeResponseData('ChannelId', channel.Id);
    this.storeResponseData('ChannelName', channel.Name);
    if (this.primaryMediaStoreEgressUrl) {
      this.storeResponseData('PrimaryMediaStoreEgressUrl', this.primaryMediaStoreEgressUrl);
    }
    if (this.backupMediaStoreEgressUrl) {
      this.storeResponseData('BackupMediaStoreEgressUrl', this.backupMediaStoreEgressUrl);
    }


    if (diff.PS_START_CHANNEL == 'YES' || this.$event.ResourceProperties.PS_START_CHANNEL == 'YES') {
      console.log('Starting');
      const startChannelParams = {
        ChannelId: channel.Id,
      };
      console.log(startChannelParams);
      await this.startChannel(ChannelId);
    } else if (diff.PS_START_CHANNEL == 'NO') {
      console.log('Stopping');
      const stopChannelParam = {
        ChannelId: channel.Id,
      };
      await this.stopChannel(ChannelId);
      console.log(stopChannelParam);
    }

    console.log(JSON.stringify(this.responseData, null, 2));
    return this.responseData;
  }

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

module.exports.Flagfish = Flagfish;
/* eslint-enable */
