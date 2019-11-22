const category = 'video';
const path = require('path');
const ora = require('ora');

const { copyFilesToS3 } = require('./provider-utils/awscloudformation/utils/video-staging');

async function add(context, providerName, service) {
  const options = {
    service,
    providerPlugin: providerName,
  };
  const providerController = require(`./provider-utils/${providerName}/index`);
  if (!providerController) {
    context.print.error('Provider not configured for this category');
    return;
  }
  return providerController.addResource(context, category, service, options);
}

async function console(context) {
  context.print.info(`to be implemented: ${category} console`);
}

async function onAmplifyCategoryOutputChange(context) {
  // Hard coded to CF. Find a better way to handle this.
  const infoController = require('./provider-utils/awscloudformation/utils/video-getinfo');
  await infoController.getInfoVideoAll(context);
}


async function migrate(context) {
  const { projectPath, amplifyMeta } = context.migrationInfo;
  const migrateResourcePromises = [];
  Object.keys(amplifyMeta).forEach((categoryName) => {
    if (categoryName === category) {
      Object.keys(amplifyMeta[category]).forEach((resourceName) => {
        try {
          const providerController = require(`./provider-utils/${amplifyMeta[category][resourceName].providerPlugin}/index`);
          if (providerController) {
            migrateResourcePromises.push(providerController.migrateResource(
              context,
              projectPath,
              amplifyMeta[category][resourceName].service,
              resourceName,
            ));
          } else {
            context.print.error(`Provider not configured for ${category}: ${resourceName}`);
          }
        } catch (e) {
          context.print.warning(`Could not run migration for ${category}: ${resourceName}`);
          throw e;
        }
      });
    }
  });

  await Promise.all(migrateResourcePromises);
}

async function executeAmplifyCommand(context) {
  let commandPath = path.normalize(path.join(__dirname, 'commands'));
  if (context.input.command === 'help') {
    commandPath = path.join(commandPath, category);
  } else {
    commandPath = path.join(commandPath, category, context.input.command);
  }

  const commandModule = require(commandPath);
  await commandModule.run(context);
}

async function handleAmplifyEvent(context, args) {
  if (args.event === 'PrePush') {
    handlePrePush(context);
  } else {
    // console.log(args.event);
  }
}

async function handlePrePush(context) {
  const { amplify } = context;
  const amplifyMeta = amplify.getProjectMeta();
  const spinner = ora('Copying video resources. This may take a few minutes...');

  if (!(category in amplifyMeta) || Object.keys(amplifyMeta[category]).length === 0) {
    return;
  }

  spinner.start();

  Object.keys(amplifyMeta[category]).forEach((resourceName) => {
    const options = amplifyMeta.video[resourceName];
    const serviceMetadata = context.amplify.readJsonFile(`${__dirname}/provider-utils/supported-services.json`)[options.serviceType];
    const { stackFolder } = serviceMetadata;
    copyFilesToS3(context, options, resourceName, stackFolder);
  });
  spinner.succeed('All resources copied.');
}

module.exports = {
  add,
  console,
  migrate,
  onAmplifyCategoryOutputChange,
  executeAmplifyCommand,
  handleAmplifyEvent,
};
