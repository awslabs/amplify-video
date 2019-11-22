/* eslint-disable strict */
/* eslint-disable global-require */
/* eslint-disable no-console */
const { CloudFormationResponse } = require('./lib/cfResponse');
const { Babelfish } = require('./lib/babelfish');
const { Flagfish } = require('./lib/flagfish');
const { Jellyfish } = require('./lib/jellyfish');
const { Distribution } = require('./lib/distribution');

/**
 *
 * @function MediaPackageChannel
 *
 */
exports.MediaPackageChannel = async (event, context) => {
  console.log(`
const event = ${JSON.stringify(event, null, 2)};
const context = ${JSON.stringify(context, null, 2)};
  `);

  let response;
  const cfResponse = new CloudFormationResponse(event, context);
  try {
    const instance = new Babelfish(event, context);
    response = await instance.entry();
    response = await cfResponse.send(response);
    return response;
  } catch (e) {
    console.error(e);
    response = await cfResponse.send(e);
    return response;
  }
};

/**
 *
 * @function MediaLiveChannel
 *
 */
exports.MediaLiveChannel = async (event, context) => {
  console.log(`
const event = ${JSON.stringify(event, null, 2)};
const context = ${JSON.stringify(context, null, 2)};
  `);

  let response;
  const cfResponse = new CloudFormationResponse(event, context);
  try {
    const instance = new Flagfish(event, context);
    response = await instance.entry();
    response = await cfResponse.send(response);
    return response;
  } catch (e) {
    console.error(e);
    response = await cfResponse.send(e);
    return response;
  }
};

/**
 * @function MediaStoreContainer
 * @description backend lambda to create/delete MediaStore container
 * @param {object} event - event information
 * @param {object} context - lambda context
 */
exports.MediaStoreContainer = async (event, context) => {
  console.log(`
const event = ${JSON.stringify(event, null, 2)};
const context = ${JSON.stringify(context, null, 2)};
  `);

  let response;
  const cfResponse = new CloudFormationResponse(event, context);
  try {
    const instance = new Jellyfish(event, context);
    response = await instance.entry();
    response = await cfResponse.send(response);
    return response;
  } catch (e) {
    console.error(e);
    response = await cfResponse.send(e);
    return response;
  }
};

/**
 *
 * @function UpdateDistribution
 *
 */
exports.UpdateDistribution = async (event, context) => {
  console.log(`
const event = ${JSON.stringify(event, null, 2)};
const context = ${JSON.stringify(context, null, 2)};
  `);

  let response;
  const cfResponse = new CloudFormationResponse(event, context);
  try {
    const instance = new Distribution(event, context);
    response = await instance.entry();
    response = await cfResponse.send(response);
    return response;
  } catch (e) {
    console.error(e);
    response = await cfResponse.send(e);
    return response;
  }
};
