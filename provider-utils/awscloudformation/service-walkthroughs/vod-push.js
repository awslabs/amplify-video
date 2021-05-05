const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const ejs = require('ejs');
const { generateKeyPairSync } = require('crypto');
const headlessMode = require('../utils/headless-mode');
const question = require('../../vod-questions.json');
const { getAWSConfig } = require('../utils/get-aws');
const { generateIAMAdmin, generateIAMAdminPolicy } = require('./vod-roles');

module.exports = {
  serviceQuestions,
};

async function serviceQuestions(context, options, defaultValuesFilename, resourceName) {
  const { amplify } = context;
  const projectMeta = context.amplify.getProjectMeta();
  const projectDetails = context.amplify.getProjectDetails();
  const defaultLocation = path.resolve(`${__dirname}/../default-values/${defaultValuesFilename}`);
  const defaults = JSON.parse(fs.readFileSync(`${defaultLocation}`));
  const targetDir = amplify.pathManager.getBackendDirPath();
  const props = {};
  const defaultName = 'myvodstreams';
  let oldValues = {};
  let nameDict = {};
  let aws;

  const { inputs } = question.video;
  const { payload } = context.parameters.options;
  const args = payload ? JSON.parse(payload) : {};

  const nameProject = [
    {
      type: inputs[0].type,
      name: inputs[0].key,
      message: inputs[0].question,
      validate: amplify.inputValidation(inputs[0]),
      default: defaultName,
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[0].key,
          value: args.resourceName ? args.resourceName : defaultName,
        });
      },
    }];

  if (resourceName) {
    nameDict.resourceName = resourceName;
    props.shared = nameDict;
    try {
      oldValues = JSON.parse(fs.readFileSync(`${targetDir}/video/${resourceName}/${projectDetails.localEnvInfo.envName}-props.json`));
      Object.assign(defaults, oldValues);
    } catch (err) {
      // Do nothing
    }
    props.shared.bucketInput = defaults.shared.bucketInput;
    props.shared.bucketOutput = defaults.shared.bucketOutput;
  } else {
    nameDict = await inquirer.prompt(nameProject);
    props.shared = nameDict;
    const uuid = Math.random().toString(36).substring(2, 6)
                + Math.random().toString(36).substring(2, 6);
    props.shared.bucketInput = `${nameDict.resourceName.toLowerCase()}-${projectDetails.localEnvInfo.envName}-input-${uuid}`.slice(0, 63);
    props.shared.bucketOutput = `${nameDict.resourceName.toLowerCase()}-${projectDetails.localEnvInfo.envName}-output-${uuid}`.slice(0, 63);
  }

  props.shared.bucket = projectMeta.providers.awscloudformation.DeploymentBucketName;

  if (!fs.existsSync(`${targetDir}/video/${props.shared.resourceName}/`)) {
    fs.mkdirSync(`${targetDir}/video/${props.shared.resourceName}/`, { recursive: true });
  }

  props.template = {};

  const pluginDir = path.join(`${__dirname}/..`);
  const templates = fs.readdirSync(`${pluginDir}/templates/`);
  const availableTemplates = [];

  templates.forEach((filepath) => {
    const templateInfo = JSON.parse(fs.readFileSync(`${pluginDir}/templates/${filepath}`));
    availableTemplates.push({
      name: templateInfo.Description,
      value: filepath,
    });
  });

  availableTemplates.push({
    name: 'Bring your own template',
    value: 'advanced',
  });
  const templateQuestion = [
    {
      type: inputs[1].type,
      name: inputs[1].key,
      message: inputs[1].question,
      choices: availableTemplates,
      default: availableTemplates[0].value,
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[1].key,
          value: args.encodingTemplate ? args.encodingTemplate : availableTemplates[0].value,
        });
      },
    },
  ];
  const template = await inquirer.prompt(templateQuestion);

  if (template.encodingTemplate === 'advanced') {
    let jobTemplate = {};
    while (!('JobTemplate' in jobTemplate)) {
      const provider = getAWSConfig(context, options);
      aws = await provider.getConfiguredAWSClient(context);
      let mcClient = new aws.MediaConvert();
      const encodingTemplateName = [
        {
          type: inputs[2].type,
          name: inputs[2].key,
          message: inputs[2].question,
          validate: amplify.inputValidation(inputs[2]),
        },
      ];
      try {
        const endpoints = await mcClient.describeEndpoints().promise();
        aws.config.mediaconvert = { endpoint: endpoints.Endpoints[0].Url };
        // Override so config applies
        mcClient = new aws.MediaConvert();
      } catch (e) {
        context.print.error(e.message);
      }
      const advTemplate = await inquirer.prompt(encodingTemplateName);
      props.template.name = advTemplate.encodingTemplate;
      const params = {
        Name: props.template.name,
      };

      try {
        jobTemplate = await mcClient.getJobTemplate(params).promise();
        // Regex: Replaces System- if found at the beginning of the name with ''
        jobTemplate.JobTemplate.Name = jobTemplate.JobTemplate.Name.replace(/^(System-)/, '');
        delete jobTemplate.JobTemplate.Arn;
        delete jobTemplate.JobTemplate.CreatedAt;
        delete jobTemplate.JobTemplate.LastUpdated;
        delete jobTemplate.JobTemplate.Type;
        delete jobTemplate.JobTemplate.StatusUpdateInterval;
        delete jobTemplate.JobTemplate.Priority;
        fs.outputFileSync(`${targetDir}/video/${props.shared.resourceName}/mediaconvert-job-temp.json`, JSON.stringify(jobTemplate.JobTemplate, null, 4));
      } catch (e) {
        context.print.error(e.message);
      }
    }
  } else {
    props.template.name = template.encodingTemplate;
    fs.copySync(`${pluginDir}/templates/${template.encodingTemplate}`, `${targetDir}/video/${props.shared.resourceName}/mediaconvert-job-temp.json`);
  }

  // prompt for cdn
  props.contentDeliveryNetwork = {};
  const cdnEnable = [
    {
      type: inputs[3].type,
      name: inputs[3].key,
      message: inputs[3].question,
      validate: amplify.inputValidation(inputs[3]),
      default: defaults.contentDeliveryNetwork[inputs[3].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[3].key,
          value: args.enableCDN ? args.enableCDN : defaults.contentDeliveryNetwork[inputs[3].key],
        });
      },
    }];

  const cdnResponse = await inquirer.prompt(cdnEnable);

  if (cdnResponse.enableCDN === true) {
    const contentDeliveryNetwork = await createCDN(context, props, options, aws, oldValues);
    props.contentDeliveryNetwork = contentDeliveryNetwork;
  }

  props.contentDeliveryNetwork.enableDistribution = cdnResponse.enableCDN;

  const cmsEnable = [
    {
      type: inputs[4].type,
      name: inputs[4].key,
      message: inputs[4].question,
      validate: amplify.inputValidation(inputs[4]),
      default: defaults.contentManagementSystem[inputs[4].key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[4].key,
          value: args.enableCMS ? args.enableCMS : false,
        });
      },
    }];

  const cmsResponse = await inquirer.prompt(cmsEnable);

  props.parameters = {
    authRoleName: {
      Ref: 'AuthRoleName',
    },
  };

  if (cmsResponse.enableCMS) {
    let apiName = getAPIName(context);
    if (apiName === '') {
      context.print.warning('Video On Demand only supports GraphQL right now.');
      context.print.warning('If you want to only use API for CMS then choose the default ToDo and don\'t edit it until later.');
      const apiPlugin = amplify.getPluginInstance(context, 'api');
      context.input.command = 'add';
      await apiPlugin.executeAmplifyCommand(context);
      apiName = getAPIName(context);
    } else {
      context.print.info(`Using ${apiName} to manage API`);
    }

    await createCMS(context, apiName, props);
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
  }

  return props;
}

async function createCDN(context, props, options, aws, oldValues) {
  const { inputs } = question.video;
  const { payload } = context.parameters.options;
  const { amplify } = context;
  const args = payload ? JSON.parse(payload) : {};
  const projectDetails = amplify.getProjectDetails();
  const cdnConfigDetails = {};

  if (oldValues.contentDeliveryNetwork && oldValues.contentDeliveryNetwork.signedKey) {
    const signedURLQuestion = [{
      type: inputs[7].type,
      name: inputs[7].key,
      message: inputs[7].question,
      choices: inputs[7].options,
      default: 'leave',
    }];
    const signedURLResponse = await inquirer.prompt(signedURLQuestion);
    if (signedURLResponse.modifySignedUrl === 'leave') {
      return oldValues.contentDeliveryNetwork;
    }
    if (signedURLResponse.modifySignedUrl === 'remove') {
      cdnConfigDetails.signedKey = false;
    } else {
      cdnConfigDetails.signedKey = true;
    }
  } else {
    const signedURLQuestion = [{
      type: inputs[9].type,
      name: inputs[9].key,
      message: inputs[9].question,
      validate: amplify.inputValidation(inputs[9]),
      default: true,
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: inputs[9].key,
          value: args.signedKey ? args.signedKey : false,
        });
      },
    }];
    const signedURLResponse = await inquirer.prompt(signedURLQuestion);

    cdnConfigDetails.signedKey = signedURLResponse.signedKey;
  }

  if (cdnConfigDetails.signedKey) {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    if (!aws) {
      const provider = getAWSConfig(context, options);
      aws = await provider.getConfiguredAWSClient(context);
    }
    const uuid = Math.random().toString(36).substring(2, 6)
                + Math.random().toString(36).substring(2, 6);
    const secretName = `${props.shared.resourceName}-${projectDetails.localEnvInfo.envName}-pem-${uuid}`.slice(0, 63);
    const rPublicName = `rCloudFrontPublicKey${projectDetails.localEnvInfo.envName}${uuid}`.slice(0, 63);
    const publicKeyName = `${props.shared.resourceName}-${projectDetails.localEnvInfo.envName}-publickey-${uuid}`.slice(0, 63);
    const smClient = new aws.SecretsManager({ apiVersion: '2017-10-17' });
    const createSecretParams = {
      Name: secretName,
      SecretBinary: privateKey,
    };
    const secretCreate = await smClient.createSecret(createSecretParams).promise();
    cdnConfigDetails.publicKey = publicKey.replace(/\n/g, '\\n');
    // Note: This is NOT best pratices for CloudFormation but their is
    // a bug with CloudFront's new Key Groups that doesn't allow
    // us to rotate them so we are temporary doing a hard rotate
    // Ref: ISSUE - TBD
    cdnConfigDetails.rPublicName = rPublicName;
    cdnConfigDetails.publicKeyName = publicKeyName;
    cdnConfigDetails.secretPem = secretCreate.Name;
    cdnConfigDetails.secretPemArn = secretCreate.ARN;
    cdnConfigDetails.functionName = (projectDetails.localEnvInfo.envName)
      ? `${props.shared.resourceName}-${projectDetails.localEnvInfo.envName}-tokenGen` : `${props.shared.resourceName}-tokenGen`;
    cdnConfigDetails.functionNameSchema = `${props.shared.resourceName}-\${env}-tokenGen`;
  }
  return cdnConfigDetails;
}

async function createCMS(context, apiName, props) {
  const { inputs } = question.video;
  const permissions = [
    {
      type: inputs[11].type,
      name: inputs[11].key,
      message: inputs[11].question,
      choices: inputs[11].options,
      validate(answer) {
        if (answer.length < 1) {
          return 'You must choose at least one auth style';
        }
        return true;
      },
    },
  ];
  const cmsEdit = [
    {
      type: inputs[10].type,
      name: inputs[10].key,
      message: inputs[10].question,
      default: true,
    },
    {
      type: inputs[6].type,
      name: inputs[6].key,
      message: inputs[6].question,
      default: true,
    }];
  const backEndDir = context.amplify.pathManager.getBackendDirPath();
  const resourceDir = path.normalize(path.join(backEndDir, 'api', apiName));
  let authConfig = {};
  const amplifyMeta = context.amplify.getProjectMeta();
  if ('api' in amplifyMeta && Object.keys(amplifyMeta.api).length !== 0) {
    Object.values(amplifyMeta.api).forEach((project) => {
      if ('output' in project) {
        ({ authConfig } = project.output);
      }
    });
  }
  const permissionsResponse = await inquirer.prompt(permissions);
  props.permissions = permissionsResponse;

  if (fs.existsSync(`${resourceDir}/schema.graphql`)) {
    const currentSchema = fs.readFileSync(`${resourceDir}/schema.graphql`);
    if (!currentSchema.includes('videoObject') && !currentSchema.includes('vodAsset')) {
      const parameters = JSON.parse(fs.readFileSync(`${resourceDir}/parameters.json`));
      const cmsEditResponse = await inquirer.prompt(cmsEdit);
      const editSchemaChoice = cmsEditResponse.editAPI;

      props.cms = cmsEditResponse;

      await writeNewModel(resourceDir, props);

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
  if (props.permissions.permissionSchema.includes('admin')) {
    authGroupHack(context, props.shared.bucketInput);
  }
  createDependency(context, props, apiName);
}

async function writeNewModel(resourceDir, props) {
  const appendSchemaTemplate = await fs.readFileSync(`${__dirname}/../schemas/schema.graphql.ejs`, { encoding: 'utf-8' });
  const appendSchema = ejs.render(appendSchemaTemplate, props);

  if (props.cms.overrideSchema) {
    await fs.writeFileSync(`${resourceDir}/schema.graphql`, appendSchema);
  } else {
    await fs.appendFileSync(`${resourceDir}/schema.graphql`, appendSchema);
  }
}

async function createDependency(context, props, apiName) {
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
