const inquirer = require('inquirer');
const fs = require('fs');

const subcommand = 'build';
const category = 'video';

module.exports = {
  name: subcommand,
  run: async (context) => {
    const { amplify } = context;
    const amplifyMeta = amplify.getProjectMeta();
    const targetDir = amplify.pathManager.getBackendDirPath();
    const projectDetails = context.amplify.getProjectDetails();
    const newEnvName = projectDetails.localEnvInfo.envName;
    const resourceFilesBaseDir = `${targetDir}/video/${shared.resourceName}/`;
    const resourceFilesList = fs.readdirSync(resourceFilesBaseDir);

    if (!(category in amplifyMeta) || Object.keys(amplifyMeta[category]).length === 0) {
      context.print.error(`You have no ${category} projects.`);
      return;
    }

    const chooseProject = [
      {
        type: 'list',
        name: 'resourceName',
        message: 'Choose what project you want to build?',
        choices: Object.keys(amplifyMeta[category]),
        default: Object.keys(amplifyMeta[category])[0],
      },
    ];
    const shared = await inquirer.prompt(chooseProject);

    const options = amplifyMeta.video[shared.resourceName];

    const { buildTemplates } = require(`../../provider-utils/${options.providerPlugin}/utils/video-staging`);
    if (!buildTemplates) {
      context.print.error('No builder is configured for this provider');
      return;
    }

    // Check if env-specific props file already exists
    const hasOwnEnvProps = resourceFilesList.includes(`${newEnvName}-props.json`);

    // Check if ANY props file exist for a different env in this project  || returns array
    const hasAnyEnvProps = resourceFilesList.find(fileName => fileName.includes('-props.json'));

    // If this env doesn't have its own props AND there is an existing amplify-video resource
    if (!hasOwnEnvProps && hasAnyEnvProps) {
      // take the first props file you find and copy that!
      const propsFilenameToCopy = resourceFilesList.filter(propsFileName => propsFileName.includes('-props.json'))[0];

      // extract substring for the existing env's name we're going to copy over
      const envNameToReplace = propsFilenameToCopy.substr(0, propsFilenameToCopy.indexOf('-'));

      // read JSON from the existing env's props file
      const existingPropsToMutate = JSON.parse(fs.readFileSync(`${resourceFilesBaseDir}/${propsFilenameToCopy}`));

      const searchAndReplaceProps = () => {
        const newPropsObj = {};
        // eslint-disable-next-line no-restricted-syntax
        for (const [key, value] of Object.entries(existingPropsToMutate.contentDeliveryNetwork)) {
          // look for any string values that contain existing env's name
          if (typeof value === 'string' && value.includes(`${envNameToReplace}`)) {
            // replace with new env name
            const newValue = value.replace(new RegExp(envNameToReplace, 'g'), `${newEnvName}`);
            newPropsObj[key] = newValue;
          } else {
            // copy existing values that do not match replacement conditions aka "generic props"
            newPropsObj[key] = value;
          }
        }
        return newPropsObj;
      };

      // merge new props and existing generic props
      const newPropsToSave = Object.assign(
        existingPropsToMutate, { contentDeliveryNetwork: searchAndReplaceProps() },
      );

      fs.writeFileSync(`${resourceFilesBaseDir}/${newEnvName}-props.json`, JSON.stringify(newPropsToSave, null, 4));
    }

    const props = JSON.parse(fs.readFileSync(`${targetDir}/video/${shared.resourceName}/${projectDetails.localEnvInfo.envName}-props.json`));

    return buildTemplates(context, props);
  },

};
