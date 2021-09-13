// Move API to this file and move to headless?

const inquirer = require('inquirer');

module.exports = {
  serviceQuestions,
  createCDNEnvVars,
};

async function apiQuestions(context, options, defaultValuesFilename, resourceName) {
  const { amplify } = context;
  const projectMeta = context.amplify.getProjectMeta();
  const projectDetails = context.amplify.getProjectDetails();
  const defaultLocation = path.resolve(`${__dirname}/../default-values/${defaultValuesFilename}`);
  const defaults = JSON.parse(fs.readFileSync(`${defaultLocation}`));
  const targetDir = amplify.pathManager.getBackendDirPath();
  const props = {
    version:1,
    serviceConfiguration:{
      serviceName:'AppSync',
      apiName:'VideoManagementApi',
      transformSchema:'',
      defaultAuthType: {
        mode:'',
      }
    }
  };


//   {
//     "version": 1,
//     "serviceConfiguration": {
//       "serviceName": "AppSync",
//       "apiName": "myNewHeadlessApi",
//       "transformSchema": "type Todo @model {\r\n  id: ID!\r\n  name: String!\r\n  description: String\r\n}",
//       "defaultAuthType": {
//         "mode": "API_KEY"
//       }
//     }
// }



  return JSON.stringify(props);
}

