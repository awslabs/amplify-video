const inquirer = require('inquirer');
const question = require('../../ivs-questions.json');

module.exports = {
  serviceQuestions,
};

async function serviceQuestions(context, options, defaultValuesFilename, resourceName) {
  const { amplify } = context;
  const projectMeta = context.amplify.getProjectMeta();
  // const projectDetails = context.amplify.getProjectDetails();
  // const defaultLocation =
  // path.resolve(`${__dirname}/../default-values/${defaultValuesFilename}`);
  // const defaults = JSON.parse(fs.readFileSync(`${defaultLocation}`));
  // const targetDir = amplify.pathManager.getBackendDirPath();
  const props = {};
  let nameDict = {};

  const { inputs } = question.video;
  const nameProject = [
    {
      type: inputs[0].type,
      name: inputs[0].key,
      message: inputs[0].question,
      validate: amplify.inputValidation(inputs[0]),
      default: 'mylivestream',
    }];

  if (resourceName) {
    nameDict.resourceName = resourceName;
    props.shared = nameDict;
  } else {
    nameDict = await inquirer.prompt(nameProject);
    props.shared = nameDict;
  }
  props.shared.bucket = projectMeta.providers.awscloudformation.DeploymentBucketName;

  return props;
}
