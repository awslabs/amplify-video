const fs = require('fs');
const chalk = require('chalk');
const { buildTemplates } = require('./utils/video-staging');

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
  if (!fs.existsSync(`${targetDir}/video/${result.shared.resourceName}/`)) {
    fs.mkdirSync(`${targetDir}/video/${result.shared.resourceName}/`, { recursive: true });
  }
  if (result.parameters !== undefined) {
    await fs.writeFileSync(`${targetDir}/video/${result.shared.resourceName}/parameters.json`, JSON.stringify(result.parameters, null, 4));
  }
  await fs.writeFileSync(`${targetDir}/video/${result.shared.resourceName}/props.json`, JSON.stringify(result, null, 4));
  await buildTemplates(context, result);
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

  const { amplify } = context;
  const amplifyMeta = context.amplify.getProjectMeta();
  if (amplifyMeta.video[resourceName].output) {
    const targetDir = amplify.pathManager.getBackendDirPath();
    try {
      const props = JSON.parse(fs.readFileSync(`${targetDir}/video/${resourceName}/props.json`));
      if ((props.mediaLive.autoStart === 'YES' && start) || (props.mediaLive.autoStart === 'NO' && !start)) {
        props.mediaLive.autoStart = !start ? 'YES' : 'NO';
        await fs.writeFileSync(`${targetDir}/video/${props.shared.resourceName}/props.json`, JSON.stringify(props, null, 4));
        await buildTemplates(context, props);
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

module.exports = {
  addResource,
  updateResource,
  livestreamStartStop,
};
