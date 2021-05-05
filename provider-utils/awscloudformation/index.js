const fs = require('fs');
const chalk = require('chalk');
const { buildTemplates } = require('./utils/video-staging');
const { liveStartStop } = require('./utils/livestream-startstop');

let serviceMetadata;

async function addResource(context, service, options) {
  serviceMetadata = context.amplify.readJsonFile(`${__dirname}/../supported-services.json`)[service];
  const targetDir = context.amplify.pathManager.getBackendDirPath();
  const projectDetails = context.amplify.getProjectDetails();
  const { serviceWalkthroughFilename, defaultValuesFilename } = serviceMetadata;
  const serviceWalkthroughSrc = `${__dirname}/service-walkthroughs/${serviceWalkthroughFilename}`;
  const { serviceQuestions } = require(serviceWalkthroughSrc);
  const result = await serviceQuestions(context, options, defaultValuesFilename);
  context.amplify.updateamplifyMetaAfterResourceAdd(
    'video',
    result.shared.resourceName,
    options,
  );
  if (!fs.existsSync(`${targetDir}/video/${result.shared.resourceName}/`)) {
    fs.mkdirSync(`${targetDir}/video/${result.shared.resourceName}/`, { recursive: true });
  }
  if (result.parameters !== undefined) {
    await fs.writeFileSync(`${targetDir}/video/${result.shared.resourceName}/parameters.json`, JSON.stringify(result.parameters, null, 4));
  }
  await fs.writeFileSync(`${targetDir}/video/${result.shared.resourceName}/${projectDetails.localEnvInfo.envName}-props.json`, JSON.stringify(result, null, 4));
  await buildTemplates(context, result);
}

async function updateResource(context, service, options, resourceName) {
  serviceMetadata = context.amplify.readJsonFile(`${__dirname}/../supported-services.json`)[service];
  const targetDir = context.amplify.pathManager.getBackendDirPath();
  const projectDetails = context.amplify.getProjectDetails();
  const { serviceWalkthroughFilename, defaultValuesFilename } = serviceMetadata;
  const serviceWalkthroughSrc = `${__dirname}/service-walkthroughs/${serviceWalkthroughFilename}`;
  const { serviceQuestions } = require(serviceWalkthroughSrc);
  const result = await serviceQuestions(context, options, defaultValuesFilename, resourceName);
  if (result.parameters !== undefined) {
    await fs.writeFileSync(`${targetDir}/video/${result.shared.resourceName}/parameters.json`, JSON.stringify(result.parameters, null, 4));
  }
  await fs.writeFileSync(`${targetDir}/video/${result.shared.resourceName}/${projectDetails.localEnvInfo.envName}-props.json`, JSON.stringify(result, null, 4));
  await buildTemplates(context, result);
  context.print.success(`Successfully updated ${result.shared.resourceName}`);
}

async function livestreamStartStop(context, service, options, resourceName, start) {
  const { amplify } = context;
  const amplifyMeta = amplify.getProjectMeta();

  if (amplifyMeta.video[resourceName].output) {
    const resourceId = amplifyMeta.video[resourceName].output.oMediaLiveChannelId;
    await liveStartStop(context, options, resourceId, start);
  } else {
    context.print.warning(chalk`{bold You have not pushed ${resourceName} to the cloud yet.}`);
  }
}

module.exports = {
  addResource,
  updateResource,
  livestreamStartStop,
};
