const inquirer = require('inquirer');
const fs = require('fs-extra');
const path = require('path');
const ejs = require('ejs');
const { generateKeyPairSync } = require('crypto');
const headlessMode = require('../utils/headless-mode');
const question = require('../../vod-questions.json');
const { getAWSConfig } = require('../utils/get-aws');
const { generateIAMGroupPolicy } = require('./vod-roles');

module.exports = {
  serviceQuestions,
  createCDNEnvVars,
};

async function serviceQuestions(context, options, defaultValuesFilename, resourceName) {
  const { amplify } = context;
  const projectMeta = context.amplify.getProjectMeta();
  const projectDetails = context.amplify.getProjectDetails();
  const defaultLocation = path.resolve(`${__dirname}/../default-values/${defaultValuesFilename}`);
  const defaults = JSON.parse(fs.readFileSync(`${defaultLocation}`));
  const targetDir = amplify.pathManager.getBackendDirPath();
  const props = {};
  let oldValues = {};
  let nameDict = {};
  let aws;

  const { payload } = context.parameters.options;
  const args = payload ? JSON.parse(payload) : {};

  const nameProject = [
    {
      type: question.resourceName.type,
      name: question.resourceName.key,
      message: question.resourceName.question,
      validate: amplify.inputValidation(question.resourceName),
      default: question.resourceName.default,
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.resourceName.key,
          value: args.resourceName ? args.resourceName : question.resourceName.default,
        });
      },
    }];

  if (resourceName) {
    nameDict.resourceName = resourceName;
    props.shared = nameDict;
    // TODO: find a way of using default values from new question
    try {
      oldValues = JSON.parse(fs.readFileSync(`${targetDir}/video/${resourceName}/props.json`));
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

  props.template.type = {};

  availableTemplates.push({
    name: 'Bring your own template',
    value: 'advanced',
  });
  const templateQuestion = [
    {
      type: question.encodingTemplate.type,
      name: question.encodingTemplate.key,
      message: question.encodingTemplate.question,
      choices: availableTemplates,
      default: question.encodingTemplate.default,
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.encodingTemplate.key,
          value: args.encodingTemplate ? args.encodingTemplate : availableTemplates[0].value,
        });
      },
    },
  ];
  const template = await inquirer.prompt(templateQuestion);

  const outputRendition = [];

  if (template.encodingTemplate === 'advanced') {
    let jobTemplate = {};
    while (!('JobTemplate' in jobTemplate)) {
      const provider = getAWSConfig(context, options);
      aws = await provider.getConfiguredAWSClient(context);
      let mcClient = new aws.MediaConvert();
      const encodingTemplateName = [
        {
          type: question.encodingTemplateName.type,
          name: question.encodingTemplateName.key,
          message: question.encodingTemplateName.question,
          validate: amplify.inputValidation(question.encodingTemplateName),
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
      props.template.name = advTemplate.encodingTemplateName;
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

      // determine the outputRendition of the template (HLS or DASH)
      const currentTemplate = jobTemplate.JobTemplate;

      for (let counter = 0; counter < currentTemplate.Settings.OutputGroups.length; counter++) {
        if (currentTemplate.Settings.OutputGroups[0].OutputGroupSettings.Type.includes('DASH')) {
          outputRendition.push('DASH');
        } else if (currentTemplate.Settings.OutputGroups[0].OutputGroupSettings.Type.includes('HLS')) {
          outputRendition.push('HLS');
        }
      }

      props.template.type = outputRendition;
    }
  } else {
    props.template.name = template.encodingTemplate;


    const currentTemplate = JSON.parse(fs.readFileSync(`${pluginDir}/templates/${template.encodingTemplate}`, { encoding: 'utf8', flag: 'r' }));

    for (let counter = 0; counter < currentTemplate.Settings.OutputGroups.length; counter++) {
      if (currentTemplate.Settings.OutputGroups[counter].OutputGroupSettings.Type.includes('DASH')) {
        outputRendition.push('DASH');
      } else if (currentTemplate.Settings.OutputGroups[counter].OutputGroupSettings.Type.includes('HLS')) {
        outputRendition.push('HLS');
      }
    }


    props.template.type = outputRendition;

    fs.copySync(`${pluginDir}/templates/${template.encodingTemplate}`, `${targetDir}/video/${props.shared.resourceName}/mediaconvert-job-temp.json`);
  }
  const snsQuestion = [
    {
      type: question.createSnsTopic.type,
      name: question.createSnsTopic.key,
      message: question.createSnsTopic.question,
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.createSnsTopic.key,
          value: args.createSnsTopic
            ? args.createSnsTopic
            : defaults.snsTopic[question.createSnsTopic.key],
        });
      },
    },
  ];
  const sns = await inquirer.prompt(snsQuestion);
  props.sns = {};
  props.sns.createTopic = sns.createSnsTopic;
  if (sns.createSnsTopic) {
    const snsFunctionQuestion = [
      {
        type: question.enableSnsFunction.type,
        name: question.enableSnsFunction.key,
        message: question.enableSnsFunction.question,
        when(answers) {
          return headlessMode.autoAnswer({
            context,
            answers,
            key: question.enableSnsFunction.key,
            value: args.enableSnsFunction
              ? args.enableSnsFunction
              : defaults.snsTopic[question.enableSnsFunction.key],
          });
        },
      },
    ];
    const snsFunction = await inquirer.prompt(snsFunctionQuestion);
    props.sns.snsFunction = snsFunction.enableSnsFunction;
  }
  // prompt for cdn
  props.contentDeliveryNetwork = {};
  const cdnEnable = [
    {
      type: question.enableCDN.type,
      name: question.enableCDN.key,
      message: question.enableCDN.question,
      validate: amplify.inputValidation(question.enableCDN),
      default: defaults.contentDeliveryNetwork[question.enableCDN.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.enableCDN.key,
          value: args.enableCDN
            ? args.enableCDN
            : defaults.contentDeliveryNetwork[question.enableCDN.key],
        });
      },
    }];

  const cdnResponse = await inquirer.prompt(cdnEnable);

  if (cdnResponse.enableCDN === true) {
    const contentDeliveryNetwork = await createCDN(context, props, options, aws, oldValues);
    props.contentDeliveryNetwork = contentDeliveryNetwork;
  }

  if (cdnResponse.enableCDN) {
    const customURLQuestion = [{
      type: question.customUrl.type,
      name: question.customUrl.key,
      message: question.customUrl.question,
      choices: question.customUrl.options,
      default: question.customUrl.default,
    }];
    const customURLResponse = await inquirer.prompt(customURLQuestion);
    const customUrlDetails = {}
    props.contentDeliveryNetwork.customUrl = customURLResponse.customUrl
    if (props.contentDeliveryNetwork.customUrl) {
      const customDomainQuestion = [{
        type: question.customDomain.type,
        name: question.customDomain.key,
        validate: amplify.inputValidation(question.customDomain),
        message: question.customDomain.question,
        choices: question.customDomain.options,
        default: question.customDomain.default,
      }];
      const customDomainResponse = await inquirer.prompt(customDomainQuestion);
      customUrlDetails.customDomain = customDomainResponse.customDomain
      const customRecord = [
        {
          type: question.customRecord.type,
          name: question.customRecord.key,
          message: question.customRecord.question,
          validate: amplify.inputValidation(question.customRecord),
          default: question.customDomain.default,
          when(answers) {
            return headlessMode.autoAnswer({
              context,
              answers,
              key: question.customRecord.key,
              value: args.customRecord ? args.customRecord : question.customDomain.default,
            });
          },
        }];

      const customRecordResponse = await inquirer.prompt(customRecord);
      customUrlDetails.customAlias = `${projectDetails.localEnvInfo.envName}-${customRecordResponse.customRecord}.${customUrlDetails.customDomain}`
      context.print.blue(customUrlDetails.customAlias);
      if (customUrlDetails.customAlias) {
        const certificateQuestion = [{
          type: question.certificate.type,
          name: question.certificate.key,
          validate: amplify.inputValidation(question.certificate),
          message: question.certificate.question,
          choices: question.certificate.options,
          default: question.certificate.default,
        }];
        const certificateResponse = await inquirer.prompt(certificateQuestion);
        customUrlDetails.certificateArn = certificateResponse.certificate
        if (customUrlDetails.certificateArn) {
          updateCDNEnvVars(context, props.shared.resourceName, customUrlDetails)
        }
      }
    }
  }


  props.contentDeliveryNetwork.enableDistribution = cdnResponse.enableCDN;

  const cmsEnable = [
    {
      type: question.enableCMS.type,
      name: question.enableCMS.key,
      message: question.enableCMS.question,
      validate: amplify.inputValidation(question.enableCMS),
      default: defaults.contentManagementSystem[question.enableCMS.key],
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.enableCMS.key,
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

  let authName = getAuthName(context);
  if (!authName) {
    context.print.warning('You have no auth projects.');
  }
  else {
    props.parameters.UserPoolId = {
      'Fn::GetAtt': [
        `auth${authName}`,
        'Outputs.UserPoolId',
      ],
    };

  }


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
  const { payload } = context.parameters.options;
  const { amplify } = context;
  const args = payload ? JSON.parse(payload) : {};
  const cdnConfigDetails = {};

  if (oldValues.contentDeliveryNetwork && oldValues.contentDeliveryNetwork.signedKey) {
    const signedURLQuestion = [{
      type: question.modifySignedUrl.type,
      name: question.modifySignedUrl.key,
      message: question.modifySignedUrl.question,
      choices: question.modifySignedUrl.options,
      default: question.modifySignedUrl.default,
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
      type: question.signedKey.type,
      name: question.signedKey.key,
      message: question.signedKey.question,
      validate: amplify.inputValidation(question.signedKey),
      default: question.signedKey.default,
      when(answers) {
        return headlessMode.autoAnswer({
          context,
          answers,
          key: question.signedKey.key,
          value: args.signedKey ? args.signedKey : false,
        });
      },
    }];
    const signedURLResponse = await inquirer.prompt(signedURLQuestion);

    cdnConfigDetails.signedKey = signedURLResponse.signedKey;
  }

  if (cdnConfigDetails.signedKey) {
    await createCDNEnvVars(context, options, props.shared.resourceName, aws);
    cdnConfigDetails.functionNameSchema = `${props.shared.resourceName}-\${env}-tokenGen`;
  }

  return cdnConfigDetails;
}

async function createCDNEnvVars(context, options, resourceName, aws) {
  const { amplify } = context;
  const projectDetails = amplify.getProjectDetails();
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
  const secretName = `${resourceName}-${projectDetails.localEnvInfo.envName}-pem-${uuid}`.slice(0, 63);
  const rPublicName = `rCloudFrontPublicKey${projectDetails.localEnvInfo.envName}${uuid}`.slice(0, 63);
  const publicKeyName = `${resourceName}-${projectDetails.localEnvInfo.envName}-publickey-${uuid}`.slice(0, 63);
  const smClient = new aws.SecretsManager({ apiVersion: '2017-10-17' });
  const createSecretParams = {
    Name: secretName,
    SecretBinary: privateKey,
  };
  const secretCreate = await smClient.createSecret(createSecretParams).promise();
  const cdnEnvConfigDetails = {};
  cdnEnvConfigDetails.publicKey = publicKey.replace(/\n/g, '\\n');
  // Note: This is NOT best pratices for CloudFormation but their is
  // a bug with CloudFront's new Key Groups that doesn't allow
  // us to rotate them so we are temporary doing a hard rotate
  // Ref: ISSUE - TBD
  cdnEnvConfigDetails.rPublicName = rPublicName;
  cdnEnvConfigDetails.publicKeyName = publicKeyName;
  cdnEnvConfigDetails.secretPem = secretCreate.Name;
  cdnEnvConfigDetails.secretPemArn = secretCreate.ARN;
  amplify.saveEnvResourceParameters(context, 'video', resourceName, cdnEnvConfigDetails);
}


async function updateCDNEnvVars(context, resourceName, customUrlDetails) {
  const { amplify } = context;
  amplify.saveEnvResourceParameters(context, 'video', resourceName, customUrlDetails);
}

async function createCMS(context, apiName, props) {
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

  if ((await getUserPoolGroups(context)).length > 0) {
    permissions[0].choices.unshift({
      "name": "Users in specific groups can upload videos",
      "value": "selectGroups",
      "next": "selectGroups",
      "checked": true,
      "ignore": true
    })
  }
  const cmsEdit = [
    {
      type: question.overrideSchema.type,
      name: question.overrideSchema.key,
      message: question.overrideSchema.question,
      default: question.overrideSchema.default,
    },
    {
      type: question.editAPI.type,
      name: question.editAPI.key,
      message: question.editAPI.question,
      default: question.editAPI.default,
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

  if (props.permissions.permissionSchema.includes('selectGroups')) {

    const selectGroups = [
      {
        type: question.selectGroups.type,
        name: question.selectGroups.key,
        message: question.selectGroups.question,
        choices: await generateGroupOptions(context),
        validate(answer) {
          if (answer.length < 1) {
            return 'You must choose at least one group';
          }
          return true;
        },
      },
    ];

    const selectGroupsResponse = await inquirer.prompt(selectGroups);
    props.permissions = { ...props.permissions, selectedGroups: selectGroupsResponse.selectGroups };
  }

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


async function getUserPoolGroups(context) {
  const userPoolGroupFile = path.join(
    context.amplify.pathManager.getBackendDirPath(),
    'auth',
    'userPoolGroups',
    'user-pool-group-precedence.json',
  );

  const amplifyMeta = context.amplify.getProjectMeta();

  let userPoolGroup = []

  if (('auth' in amplifyMeta) && Object.keys(amplifyMeta.auth).length > 0) {
    if (fs.existsSync(userPoolGroupFile)) {
      userPoolGroup = JSON.parse(fs.readFileSync(userPoolGroupFile));
    }
  }
  return userPoolGroup
}

async function generateGroupOptions(context) {
  const userPoolGroup = await getUserPoolGroups(context, true)

  let groupOptions = []

  if (userPoolGroup.length === 0) {
    context.print.error('You have no cognito groups');
  } else {
    userPoolGroup.forEach((userGroup) => {
      groupOptions.push({
        "name": userGroup.groupName,
        "value": userGroup.groupName,
        "ignore": true
      })
    });
  }
  return groupOptions
}

