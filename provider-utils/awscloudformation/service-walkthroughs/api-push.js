// Move API to this file and move to headless?
import { validateAddApiRequest, validateUpdateApiRequest,
         validateAddAuthRequest, validateUpdateAuthRequest} from 'amplify-util-headless-input';
const inquirer = require('inquirer');

module.exports = {
  setupAPI,
};

async function setupAPI(context, options, projectType, resourceName) {
  const { amplify } = context;

  const authProps = {
    version:1,
    resourceName: 'VideoAuth',
    serviceConfiguration:{
      includeIdentityPool: false,
      serviceName: 'Cognito',
      userPoolConfiguration: {
        signinMethod: "EMAIL",
        requiredSignupAttributes: [
          "EMAIL",
          "NAME",
        ],
      }
    }
  };

  const pluginAuthInfo = context.pluginPlatform.plugins['auth'][0];
  const { getAddAuthRequestAdaptor } = require(`${pluginAuthInfo.packageLocation}/lib/provider-utils/awscloudformation/utils/auth-request-adaptors.js`);
  const { getAddAuthHandler } = require(`${pluginAuthInfo.packageLocation}/lib/provider-utils/awscloudformation/handlers/resource-handlers.js`);
  await validateAddAuthRequest(JSON.stringify(authProps))
        .then(getAddAuthRequestAdaptor(amplify.getProjectConfig().frontend))
        .then(getAddAuthHandler(context));


  const apiProps = {
    version:1,
    serviceConfiguration:{
      serviceName:'AppSync',
      apiName:'VideoManagementApi',
      transformSchema:'type Todo @model {\r\n  id: ID!\r\n  name: String!\r\n  description: String\r\n}',
      defaultAuthType: {
        mode:'AMAZON_COGNITO_USER_POOLS',
      }
    }
  };
  const pluginAPIInfo = context.pluginPlatform.plugins['api'][0];
  const {getCfnApiArtifactHandler} = require(`${pluginAPIInfo.packageLocation}/lib/provider-utils/awscloudformation/cfn-api-artifact-handler.js`)
  const validateAPIProps = await validateAddApiRequest(JSON.stringify(apiProps));
  await getCfnApiArtifactHandler(context).createArtifacts(validateAPIProps);

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

