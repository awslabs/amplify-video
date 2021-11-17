const fs = require('fs-extra');
const path = require('path');
const ejs = require('ejs');
const inquirer = require('inquirer');
const { generateIAMAdmin, generateIAMAdminPolicy } = require('./vod-roles');
const question = require('../../api-questions.json');

import { validateAddApiRequest, validateUpdateApiRequest,
         validateAddAuthRequest, validateUpdateAuthRequest} from 'amplify-util-headless-input';


module.exports = {
  setupAPI,
};

async function setupAPI(context, props, projectType) {
  let apiName = getAPIName(context);
  const backEndDir = context.amplify.pathManager.getBackendDirPath();
  const resourceDir = path.normalize(path.join(backEndDir, 'api', apiName));
  
  if (apiName !== '') {
    context.print.info(`Using ${apiName} to manage API`);
    // Add check to API for API_KEY or Cognito
    // If Cognito then ask permissions question
    // send off to schemaMaker
    const genSchema = await schemaMaker(context, props, projectType);
    const cmsOveride = [
      {
        type: question.overrideSchema.type,
        name: question.overrideSchema.key,
        message: question.overrideSchema.question,
        default: question.overrideSchema.default,
      }
    ];
    const cmsOverideAnswer = await inquirer.prompt(cmsOveride);
    if (cmsOverideAnswer.overrideSchema) {
      await fs.writeFileSync(`${resourceDir}/schema.graphql`, genSchema);
    } else {
      await fs.appendFileSync(`${resourceDir}/schema.graphql`, genSchema);
    }
    await editGraphQL(context, apiName);
    
    props.parameters.GraphQLAPIId = {
      'Fn::GetAtt': [
        `api${apiName}`,
        'Outputs.GraphQLAPIIdOutput',
      ],
    };
    props.parameters.GraphQLEndpoint = {
      'Fn::GetAtt': [
        `api${apiName}`,
        'Outputs.GraphQLAPIEndpointOutput',
      ],
    };

    createDependency(context, props, apiName, projectType);

    return props;
  }

  const apiAuthQuestion = [
    {
      type: question.selectAuthModel.type,
      name: question.selectAuthModel.key,
      message: question.selectAuthModel.question,
      choices: question.selectAuthModel.options,
      default: question.selectAuthModel.default,
    },
  ];
  const authType = await inquirer.prompt(apiAuthQuestion);

  if (authType.authModel === 'AMAZON_COGNITO_USER_POOLS') {
    const authName = getAuthName(context);
    if (authName && authName !== ''){
      context.print.info(`Using ${authName} for your Authentication`);
    } else {
      await setupAuth(context);
    }
    if (projectType === 'vod') {
      const permissions = [
        {
          type: question.permissionSchema.type,
          name: question.permissionSchema.key,
          message: question.permissionSchema.question,
          choices: question.permissionSchema.options,
          validate(answer) {
            if (answer.length < 1) {
              return 'You must choose at least one auth style';
            }
            return true;
          },
        },
      ];
      const permissionsResponse = await inquirer.prompt(permissions);
      props.permissions = permissionsResponse;

      if (props.permissions.permissionSchema.includes('admin')) {
        authGroupHack(context, props.shared.bucketInput);
      }
    }
  }

  const schema = await schemaMaker(context, props, projectType);
  apiName = 'VideoManagementApi';
  const apiProps = {
    version:1,
    serviceConfiguration:{
      serviceName:'AppSync',
      apiName,
      transformSchema: schema,
      defaultAuthType: {
        mode:authType.authModel,
      }
    }
  };
  const pluginAPIInfo = context.pluginPlatform.plugins['api'][0];
  const {getCfnApiArtifactHandler} = require(`${pluginAPIInfo.packageLocation}/lib/provider-utils/awscloudformation/cfn-api-artifact-handler.js`);
  const validateAPIProps = await validateAddApiRequest(JSON.stringify(apiProps));
  await getCfnApiArtifactHandler(context).createArtifacts(validateAPIProps);

  props.parameters.GraphQLAPIId = {
    'Fn::GetAtt': [
      `api${apiName}`,
      'Outputs.GraphQLAPIIdOutput',
    ],
  };
  props.parameters.GraphQLEndpoint = {
    'Fn::GetAtt': [
      `api${apiName}`,
      'Outputs.GraphQLAPIEndpointOutput',
    ],
  };

  createDependency(context, props, apiName, projectType);

  return props;
}

async function setupAuth(context) {
  const { amplify } = context;
  const authProps = {
    version:1,
    resourceName: 'VideoAuth',
    serviceConfiguration:{
      includeIdentityPool: true,
      identityPoolConfiguration: {
      },
      serviceName: 'Cognito',
      userPoolConfiguration: {
        signinMethod: "USERNAME",
        requiredSignupAttributes: [
          "EMAIL",
        ],
        readAttributes: [
          "EMAIL",
        ],
        writeAttributes: [
          "EMAIL",
        ]
      }
    }
  };

  const pluginAuthInfo = context.pluginPlatform.plugins['auth'][0];
  const { getAddAuthRequestAdaptor } = require(`${pluginAuthInfo.packageLocation}/lib/provider-utils/awscloudformation/utils/auth-request-adaptors.js`);
  const { getAddAuthHandler } = require(`${pluginAuthInfo.packageLocation}/lib/provider-utils/awscloudformation/handlers/resource-handlers.js`);
  await validateAddAuthRequest(JSON.stringify(authProps))
        .then(getAddAuthRequestAdaptor(amplify.getProjectConfig().frontend))
        .then(getAddAuthHandler(context));
  const backEndDir = context.amplify.pathManager.getBackendDirPath();
  const resourceDir = path.normalize(path.join(backEndDir, 'auth', 'VideoAuth'));
  const parameters = JSON.parse(fs.readFileSync(`${resourceDir}/cli-inputs.json`));
  parameters.cognitoConfig.autoVerifiedAttributes = ['email'];
  fs.writeFileSync(`${resourceDir}/cli-inputs.json`, JSON.stringify(parameters, null, 2));
}

async function editGraphQL(context, apiName) {
  const backEndDir = context.amplify.pathManager.getBackendDirPath();
  const resourceDir = path.normalize(path.join(backEndDir, 'api', apiName));
  const cmsEdit = [
    {
      type: question.editAPI.type,
      name: question.editAPI.key,
      message: question.editAPI.question,
      default: question.editAPI.default,
  }];
  if (fs.existsSync(`${resourceDir}/schema.graphql`)) {
    const currentSchema = fs.readFileSync(`${resourceDir}/schema.graphql`);
    if (!currentSchema.includes('videoObject') && !currentSchema.includes('vodAsset')) {
      const parameters = JSON.parse(fs.readFileSync(`${resourceDir}/parameters.json`));
      const cmsEditResponse = await inquirer.prompt(cmsEdit);
      const editSchemaChoice = cmsEditResponse.editAPI;
      let authConfig = {};
      const amplifyMeta = context.amplify.getProjectMeta();
      if ('api' in amplifyMeta && Object.keys(amplifyMeta.api).length !== 0) {
        Object.values(amplifyMeta.api).forEach((project) => {
          if ('output' in project) {
            ({ authConfig } = project.output);
          }
        });
      }

      if (editSchemaChoice) {
        await context.amplify.openEditor(context, `${resourceDir}/schema.graphql`).then(async () => {
          let notCompiled = true;
          while (notCompiled) {
            notCompiled = await compileSchema(context, resourceDir, parameters, authConfig);
          }
        });
      } else {
        await compileSchema(context, resourceDir, parameters, authConfig);
      }
    } else {
      const fullPath = path.join(resourceDir, 'schema.graphql');
      context.print.warning(`Schema already configure. To edit it please open: ${fullPath}`);
    }
    // TODO: Add check if they switched schemas
  }

}

async function schemaMaker(context, props, projectType) {

  const appendSchemaTemplate = await fs.readFileSync(`${__dirname}/../schemas/${projectType}.schema.graphql.ejs`, { encoding: 'utf-8' });
  const appendSchema = ejs.render(appendSchemaTemplate, props);

  return appendSchema;
}

async function createDependency(context, props, apiName, projectType) {
  if (projectType === 'vod') {
    if (props.contentDeliveryNetwork.pemID && props.contentDeliveryNetwork.secretPemArn) {
      context.amplify.updateamplifyMetaAfterResourceUpdate('api', apiName, 'dependsOn', [
        {
          category: 'video',
          resourceName: props.shared.resourceName,
          attributes: [],
        },
      ]);
    }
  }
}

async function compileSchema(context, resourceDir, parameters, authConfig) {
  try {
    await context.amplify.executeProviderUtils(
      context,
      'awscloudformation',
      'compileSchema',
      { resourceDir, parameters, authConfig },
    );
    return false;
  } catch (e) {
    context.print.error('Failed compiling GraphQL schema:');
    context.print.info(e.message);
    const continueQuestion = {
      type: 'input',
      name: 'pressKey',
      message: `Correct the errors in schema.graphql and press Enter to re-compile.\n\nPath to schema.graphql:\n${resourceDir}/schema.graphql`,
    };
    await inquirer.prompt(continueQuestion);
    return true;
  }
}

function getAPIName(context) {
  const { amplifyMeta } = context.amplify.getProjectDetails();
  let apiName = '';

  if (amplifyMeta.api) {
    const categoryResources = amplifyMeta.api;
    Object.keys(categoryResources).forEach((resource) => {
      if (categoryResources[resource].service === 'AppSync') {
        apiName = resource;
      }
    });
  }
  return apiName;
}

function getAuthName(context) {
  const { amplifyMeta } = context.amplify.getProjectDetails();
  let authName = '';

  if (amplifyMeta.auth) {
    const categoryResources = amplifyMeta.auth;
    Object.keys(categoryResources).forEach((resource) => {
      if (categoryResources[resource].service === 'Cognito') {
        authName = resource;
      }
    });
  }
  return authName;
}

async function authGroupHack(context, bucketName) {
  const userPoolGroupFile = path.join(
    context.amplify.pathManager.getBackendDirPath(),
    'auth',
    'userPoolGroups',
    'user-pool-group-precedence.json',
  );

  const amplifyMeta = context.amplify.getProjectMeta();

  if (!('auth' in amplifyMeta) || Object.keys(amplifyMeta.auth).length === 0) {
    context.print.error('You have no auth projects. Moving on.');
    return;
  }

  let resourceName = '';

  Object.keys(amplifyMeta.auth).forEach((authCategory) => {
    if (amplifyMeta.auth[authCategory].service === 'Cognito') {
      resourceName = authCategory;
    }
  });

  if (fs.existsSync(userPoolGroupFile)) {
    const userPoolGroup = JSON.parse(fs.readFileSync(userPoolGroupFile));
    if (userPoolGroup.length === 0) {
      userPoolGroup.push(generateIAMAdmin(resourceName, bucketName));
    } else {
      userPoolGroup.forEach((userGroup, index) => {
        if (userGroup.groupName === 'Admin') {
          if (!('customPolicies' in userGroup)) {
            userGroup.customPolicies = [];
          }

          const policy = generateIAMAdminPolicy(resourceName, bucketName);
          if (!userGroup.customPolicies.some(
            existingPolicy => existingPolicy.PolicyName === policy.PolicyName,
          )) {
            userGroup.customPolicies.push(policy);
          }
          return;
        }
        if (userPoolGroup.length === index + 1) {
          userPoolGroup.push(generateIAMAdmin(resourceName, bucketName));
        }
      });
    }
    updateUserPoolGroups(context, userPoolGroup);
  } else {
    const admin = generateIAMAdmin(resourceName, bucketName);
    const userPoolGroupList = [admin];
    updateUserPoolGroups(context, userPoolGroupList);
    context.amplify.updateamplifyMetaAfterResourceAdd('auth', 'userPoolGroups', {
      service: 'Cognito-UserPool-Groups',
      providerPlugin: 'awscloudformation',
      dependsOn: [
        {
          category: 'auth',
          resourceName,
          attributes: ['UserPoolId', 'AppClientIDWeb', 'AppClientID', 'IdentityPoolId'],
        },
      ],
    });
  }
}


function updateUserPoolGroups(context, userPoolGroupList) {
  if (userPoolGroupList && userPoolGroupList.length > 0) {
    const userPoolGroupFile = path.join(
      context.amplify.pathManager.getBackendDirPath(),
      'auth',
      'userPoolGroups',
      'user-pool-group-precedence.json',
    );

    const userPoolGroupParams = path.join(context.amplify.pathManager.getBackendDirPath(), 'auth', 'userPoolGroups', 'parameters.json');

    /* eslint-disable */
    const groupParams = {
      AuthRoleArn: {
        'Fn::GetAtt': ['AuthRole', 'Arn'],
      },
      UnauthRoleArn: {
        'Fn::GetAtt': ['UnauthRole', 'Arn'],
      },
    };
    /* eslint-enable */

    fs.outputFileSync(userPoolGroupParams, JSON.stringify(groupParams, null, 4));
    fs.outputFileSync(userPoolGroupFile, JSON.stringify(userPoolGroupList, null, 4));
  }
}