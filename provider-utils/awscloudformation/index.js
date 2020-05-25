const fs = require('fs');
const chalk = require('chalk');
const { resetupFiles } = require('./utils/video-staging');
const { buildTemplates } = require('./utils/video-staging-new');

let serviceMetadata;

async function addResource(context, service, options) {
  serviceMetadata = context.amplify.readJsonFile(`${__dirname}/../supported-services.json`)[service];
  const targetDir = context.amplify.pathManager.getBackendDirPath();
  const { serviceWalkthroughFilename, defaultValuesFilename } = serviceMetadata;
  const serviceWalkthroughSrc = `${__dirname}/service-walkthroughs/${serviceWalkthroughFilename}`;
  const { serviceQuestions } = require(serviceWalkthroughSrc);
  const result = await serviceQuestions(context, options, defaultValuesFilename);
  context.amplify.updateamplifyMetaAfterResourceAdd(
    'video',
    result.shared.resourceName,
    options,
  );
  if (result.parameters !== undefined) {
    await fs.writeFileSync(`${targetDir}/video/${result.shared.resourceName}/parameters.json`, JSON.stringify(result.parameters, null, 4));
  }

  await fs.writeFileSync(`${targetDir}/video/${result.shared.resourceName}/props.json`, JSON.stringify(result, null, 4));
  await buildTemplates(context);
  console.log(chalk`{green Successfully configured ${result.shared.resourceName}}`);
}

async function updateResource(context, service, options, resourceName) {
  serviceMetadata = context.amplify.readJsonFile(`${__dirname}/../supported-services.json`)[service];
  const targetDir = context.amplify.pathManager.getBackendDirPath();
  const { serviceWalkthroughFilename, defaultValuesFilename } = serviceMetadata;
  const serviceWalkthroughSrc = `${__dirname}/service-walkthroughs/${serviceWalkthroughFilename}`;
  const { serviceQuestions } = require(serviceWalkthroughSrc);
  const result = await serviceQuestions(context, options, defaultValuesFilename, resourceName);
  if (result.parameters !== undefined) {
    await fs.writeFileSync(`${targetDir}/video/${result.shared.resourceName}/parameters.json`, JSON.stringify(result.parameters, null, 4));
  }

  await fs.writeFileSync(`${targetDir}/video/${result.shared.resourceName}/props.json`, JSON.stringify(result, null, 4));
  await buildTemplates(context, result);
  console.log(chalk`{green Successfully updated ${result.shared.resourceName}}`);
}

async function livestreamStartStop(context, service, options, resourceName, start) {
  serviceMetadata = context.amplify.readJsonFile(`${__dirname}/../supported-services.json`)[service];
  const { cfnFilename, stackFolder } = serviceMetadata;
  const { amplify } = context;
  const amplifyMeta = context.amplify.getProjectMeta();
  if (amplifyMeta.video[resourceName].output) {
    const targetDir = amplify.pathManager.getBackendDirPath();
    try {
      const props = JSON.parse(fs.readFileSync(`${targetDir}/video/${resourceName}/props.json`));
      if ((props.mediaLive.autoStart === 'YES' && start) || (props.mediaLive.autoStart === 'NO' && !start)) {
        props.mediaLive.autoStart = !start ? 'YES' : 'NO';
        props.shared.resourceName = resourceName;
        const serviceWalkthroughSrc = `${__dirname}/utils/video-staging.js`;
        const { updateWithProps } = require(serviceWalkthroughSrc);
        await updateWithProps(context, options, props, resourceName, cfnFilename, stackFolder);
        await amplify.constructExeInfo(context);
        await amplify.pushResources(context, 'video', resourceName).catch((err) => {
          context.print.info(err.stack);
          context.print.error('There was an error pushing the video resource');
        });
      } else {
        console.log(chalk`{bold ${resourceName} is already ${start ? 'running' : 'stopped'}.}`);
      }
    } catch (err) {
      console.log(err);
    }
  } else {
    console.log(chalk`{bold You have not pushed ${resourceName} to the cloud yet.}`);
  }
}

async function setupCloudFormation(context, service, options, resourceName) {
  serviceMetadata = context.amplify.readJsonFile(`${__dirname}/../supported-services.json`)[service];
  const { stackFolder } = serviceMetadata;
  await resetupFiles(context, options, resourceName, stackFolder);
}


module.exports = {
  addResource,
  updateResource,
  setupCloudFormation,
  livestreamStartStop,
};
