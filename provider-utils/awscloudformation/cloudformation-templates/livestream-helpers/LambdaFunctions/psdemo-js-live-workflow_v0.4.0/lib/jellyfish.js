/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/no-unresolved */
/* eslint-disable no-console */
const PATH = require('path');
const { MediaStore, MediaStoreData } = require('aws-sdk');
const { mxStoreResponse } = require('./mxStoreResponse');

const PS_PARAMS = [
  'PS_CONTAINER_NAME',
];

const REQUIRED_ENV = [
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
];

/* POLL every 4 seconds */
const POLL_INTERVAL = 4;

/**
  * @class Jellyfish
  *
  */
class Jellyfish extends mxStoreResponse(class {}) {
  constructor(event, context) {
    super();

    this.$errorFn = e => this.error(e);
    this.$event = null;
    this.$context = null;
    this.$instance = null;
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

      /* make sure container name is valid */
      const {
        ResourceProperties: { PS_CONTAINER_NAME },
      } = this.$event;
      this.$containerName = PS_CONTAINER_NAME.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_+/g, '_');

      /* jellyfish instance */
      this.$instance = new MediaStore({
        apiVersion: '2017-09-01',
      });
    } catch (e) {
      throw e;
    }
  }

  get event() { return this.$event; }

  get context() { return this.$context; }

  get requestType() { return this.$event.RequestType; }

  get containerName() { return this.$containerName; }

  get mediastore() { return this.$instance; }

  /**
    * @function isRequestType
    * @param {string} type
    *
    */
  isRequestType(type) { return this.requestType.toLowerCase() === type; }

  async describeContainer(ContainerName) {
    const response = await this.mediastore.describeContainer({
      ContainerName,
    }).promise();
    return response;
  }

  async checkContainer(ContainerName) {
    try {
      const response = await this.describeContainer(ContainerName);
      if (response) {
        const { Container } = response;
        return (Container !== undefined);
      }
      return false;
    } catch (e) {
      if (e.code === 'ContainerNotFoundException') {
        return false;
      }
      throw e;
    }
  }

  async waitForContainer(ContainerName, maxTries = 60) {
    /* eslint-disable no-unused-vars */
    const promise = new Promise((resolve, reject) => {
      const bindFn = this.describeContainer.bind(this);
      let tries = 0;

      const timer = setInterval(async () => {
        try {
          const response = await bindFn(ContainerName);
          const {
            Container: { Status, Endpoint },
          } = response;

          const ready = (Status.toUpperCase() === 'ACTIVE' && Endpoint);
          if (ready) {
            clearInterval(timer);
            resolve(response);
            return;
          }
          if (tries >= maxTries) {
            throw new Error(`${ContainerName} takes too long to complete. Cannot continue`);
          }
          tries += 1;
        } catch (e) {
          clearInterval(timer);
          console.error(e);
          reject(e);
        }
      }, POLL_INTERVAL * 1000);
    });
    /* eslint-enable no-unused-vars */
    return promise;
  }

  async createContainer(ContainerName) {
    /* make sure container doesn't exist */
    const exists = await this.checkContainer(ContainerName);
    if (exists) {
      throw new Error(`Container ${ContainerName} already exists. Quitting...`);
    }

    const response = await this.mediastore.createContainer({
      ContainerName,
    }).promise();
    const { Container: { Name } } = response;
    if (Name !== ContainerName) {
      throw new Error(`mismatch container name, ${ContainerName}/${Name} [requested/created]`);
    }
    return response;
  }

  makeContainerPolicy(arn) {
    const accountId = arn.split(':')[4];
    if (!accountId.match(/^[0-9]+$/)) {
      throw new Error(`failed to parse accountId from Arn, ${arn}`);
    }

    const Statement = [];
    /* full access for root */
    Statement.push({
      Sid: 'MediaStoreFullAccess',
      Effect: 'Allow',
      Principal: { AWS: `arn:aws:iam::${accountId}:root` },
      Action: 'mediastore:*',
      Resource: `${arn}/*`,
      Condition: { Bool: { 'aws:SecureTransport': true } },
    });
    /* public read access */
    Statement.push({
      Sid: 'PublicReadAccessOverHttps',
      Effect: 'Allow',
      Principal: '*',
      Action: [
        'mediastore:GetObject',
        'mediastore:DescribeObject',
      ],
      Resource: `${arn}/*`,
      Condition: { Bool: { 'aws:SecureTransport': true } },
    });

    return {
      ContainerName: this.containerName,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement,
      }),
    };
  }

  async putContainerPolicy(arn) {
    const params = this.makeContainerPolicy(arn);
    const response = await this.mediastore.putContainerPolicy(params).promise();
    return response;
  }

  makeCorsPolicy() {
    return {
      ContainerName: this.containerName,
      CorsPolicy: [{
        AllowedHeaders: ['*'],
        AllowedMethods: ['GET', 'HEAD'],
        AllowedOrigins: ['*'],
        ExposeHeaders: ['*'],
        MaxAgeSeconds: 3000,
      }],
    };
  }

  async putCorsPolicy() {
    const params = this.makeCorsPolicy();
    const response = await this.mediastore.putCorsPolicy(params).promise();
    return response;
  }

  /* eslint-disable class-methods-use-this */
  async listAllItems(instance, options = {}) {
    const Files = [];
    const params = Object.assign({
      MaxResults: 1000,
      Path: '',
    }, options);

    const { Path } = params;
    const {
      Items, NextToken,
    } = await instance.listItems(params).promise();

    /* collect all the files first */
    Items.filter(x => x.Type === 'OBJECT').forEach((x) => {
      Files.push(PATH.join(Path, x.Name));
    });
    /* collect folders and get objects under the folder */
    const promises = Items.filter(x => x.Type === 'FOLDER').map(x => this.listAllItems(instance, { Path: PATH.join(Path, x.Name) }));
    /* check NextToken */
    if (NextToken) {
      promises.push(this.listAllItems(instance, { Path, NextToken }));
    }
    const results = await Promise.all(promises);
    results.forEach((result) => {
      /* merge the results */
      Files.splice(Files.length, 0, ...result);
    });
    return Files;
  }

  async deleteObjects(ContainerName) {
    const {
      Container: { Endpoint },
    } = await this.describeContainer(ContainerName);
    if (!Endpoint) {
      throw new Error(`Container ${ContainerName} endpoint null`);
    }

    const instance = new MediaStoreData({
      apiVersion: '2017-09-01',
      endpoint: Endpoint,
    });

    const Files = await this.listAllItems(instance);
    console.log(JSON.stringify(Files, null, 2));

    const total = Files.length;
    /* eslint-disable no-await-in-loop */
    while (Files.length > 0) {
      const batch = Files.splice(0, 10);
      const promises = batch.map(Path => instance.deleteObject({ Path }).promise());
      await Promise.all(promises);
    }
    /* eslint-enable no-await-in-loop */
    return total;
  }

  async deleteContainer000(ContainerName) {
    try {
      await this.mediastore.deleteContainer({
        ContainerName,
      }).promise();
      return true;
    } catch (e) {
      if (e.code === 'ContainerNotFoundException') {
        return true;
      }
      if (e.code === 'ContainerInUseException') {
        console.log(`${ContainerName} ContainerInUseException`);
        return false;
      }
      throw e;
    }
  }

  async deleteContainer(ContainerName, maxTries = 40) {
    const promise = new Promise((resolve, reject) => {
      const bindFn = this.deleteContainer000.bind(this);
      let tries = 0;
      const timer = setInterval(async () => {
        try {
          const ready = await bindFn(ContainerName);
          if (ready || tries >= maxTries) {
            clearInterval(timer);
            resolve(ready);
            return;
          }
          tries += 1;
        } catch (e) {
          clearInterval(timer);
          console.error(e);
          reject(e);
        }
      }, POLL_INTERVAL * 1000);
    });
    return promise;
  }

  async waitForDeletion(ContainerName, maxTries = 45) {
    /* eslint-disable no-unused-vars */
    const promise = new Promise((resolve, reject) => {
      const bindFn = this.checkContainer.bind(this);
      let tries = 0;

      const timer = setInterval(async () => {
        try {
          const exists = await bindFn(ContainerName);
          if (!exists || tries >= maxTries) {
            clearInterval(timer);
            resolve(!exists);
            return;
          }
          tries += 1;
        } catch (e) {
          clearInterval(timer);
          console.error(e);
          resolve(e);
        }
      }, POLL_INTERVAL * 1000);
    });
    return promise;
    /* eslint-enable no-unused-vars */
  }

  async create() {
    let response;
    response = await this.createContainer(this.containerName);

    /* First, create container */
    const { Container: { ARN, Name } } = response;
    this.storeResponseData('ContainerArn', ARN);
    this.storeResponseData('ContainerName', Name);

    /* Next, wait for container to be created */
    response = await this.waitForContainer(Name);
    const { Container: { Endpoint } } = response;
    this.storeResponseData('ContainerEndpoint', Endpoint);

    /* Next, update container policy */
    response = [
      this.putContainerPolicy(ARN),
      this.putCorsPolicy(),
    ];
    await Promise.all(response);

    console.log(`responseData = ${JSON.stringify(this.responseData, null, 2)}`);
    return this.responseData;
  }

  async purge() {
    const ContainerName = this.containerName;
    const exists = await this.checkContainer(ContainerName);
    if (!exists) {
      this.storeResponseData('DeletedContainer', 'NOTEXIST');
      return this.responseData;
    }
    /* First, enumerate and delete all objects */
    const response = await this.deleteObjects(ContainerName);
    this.storeResponseData('TotalObjectsDeleted', response);

    /* Once the container is empty, we could delete it */
    const deleting = await this.deleteContainer(ContainerName);
    if (deleting === false) {
      console.log(`Container ${ContainerName} is busy. Skip deleting...`);
      this.storeResponseData('DeletedContainer', 'SKIPPED');
    } else {
      await this.waitForDeletion(ContainerName);
      this.storeResponseData('DeletedContainer', ContainerName);
    }

    console.log(JSON.stringify(this.responseData, null, 2));
    return this.responseData;
  }

  /**
    * @function entry
    * @desc decide if we are creating or purging the channel
    */
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

module.exports.Jellyfish = Jellyfish;
