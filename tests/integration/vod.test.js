const glob = require('glob');
const fs = require('fs');
const AWS = require('aws-sdk');
const axios = require('axios');
const request = require('supertest');
const CloudFrontTokenGen = require('../../provider-utils/awscloudformation/cloudformation-templates/vod-helpers/LambdaFunctions/CloudFrontTokenGen/index.js');

describe('CloudFront signed urls', () => {
  let token;
  let domainName;
  let projectProps;
  let projectPaths;
  let teamProviderPath;
  let projectNames;
  const fsOptions = {
    encoding: 'utf8', flag: 'r',
  };

  beforeAll(async () => {
    let directoryPath = `${__dirname}/../../amplify/backend/backend-config.json`;
    if (process.env.NODE_ENV !== 'test' && process.env.AMP_PATH) {
      directoryPath = `${__dirname}/../../${process.env.AMP_PATH}/amplify/backend/backend-config.json`;
    }
    const files = glob.sync(directoryPath);
    const backendConfig = JSON.parse(fs.readFileSync(files[0], fsOptions));
    projectNames = Object.entries(backendConfig.video ? backendConfig.video : {})
      .filter(([, value]) => value.serviceType === 'video-on-demand')
      .map(([project]) => project);
    projectPaths = projectNames.map((projectName) => {
      if (process.env.NODE_ENV !== 'test' && process.env.AMP_PATH) {
        return `${__dirname}/../../${process.env.AMP_PATH}/amplify/backend/video/${projectName}/props.json`;
      }
      return `${__dirname}/../../amplify/backend/video/${projectName}/props.json`;
    });
    projectProps = projectPaths
      .map(projectPath => JSON.parse(fs.readFileSync(projectPath, fsOptions)));

    teamProviderPath = `${__dirname}/../../amplify/team-provider-info.json`;
    if (process.env.NODE_ENV !== 'test' && process.env.AMP_PATH) {
      teamProviderPath = `${__dirname}/../../${process.env.AMP_PATH}/amplify/team-provider-info.json`;
    }
  });

  test('Upload file to input bucket', async () => {
    if (projectNames.length === 0) {
      console.log('No VoD projects found, passing to next tests');
      return;
    }
    const s3 = new AWS.S3();
    const teamProvider = JSON.parse(fs.readFileSync(teamProviderPath, fsOptions));
    const res = await axios.get('http://a0.awsstatic.com/main/images/logos/aws_logo.png', { responseType: 'arraybuffer' });

    Promise.all(projectNames.map(async project => await s3.putObject({
      Bucket: `${project.toLowerCase()}-${Object.keys(teamProvider)[0]}-output-${teamProvider[Object.keys(teamProvider)[0]].categories.video[project].s3UUID}`,
      Key: 'test/test.png',
      ContentType: res.headers['content-type'],
      ContentLength: res.headers['content-length'],
      Body: res.data,
    }).promise()));
  });


  test('Should generate Cloudfront token', async () => {
    if (projectNames.length === 0) {
      console.log('No VoD projects found, passing to next tests');
      return;
    }
    const cloudfront = new AWS.CloudFront();

    const enabledCDNProjects = projectProps
      .filter(props => props.contentDeliveryNetwork.enableDistribution)
      .map(props => props);

    await Promise.all(enabledCDNProjects.map(async (project) => {
      const publicKeys = await cloudfront.listPublicKeys().promise();
      const publicKey = publicKeys.PublicKeyList.Items
        .filter(key => key.Name === project.contentDeliveryNetwork.publicKeyName)
        .map(key => key)[0];
      const keyGroups = await cloudfront.listKeyGroups().promise();
      const keyGroup = keyGroups.KeyGroupList.Items
        .filter(item => item.KeyGroup.KeyGroupConfig.Name === project.contentDeliveryNetwork.functionName.replace('tokenGen', 'KeyGroup'))
        .map(group => group)[0];
      const cloudFrontDistributions = await cloudfront.listDistributionsByKeyGroup({
        KeyGroupId: keyGroup.KeyGroup.Id,
      }).promise();
      const distributionId = cloudFrontDistributions.DistributionIdList.Items[0];
      const cloudFrontDistribution = await cloudfront.getDistribution({
        Id: distributionId,
      }).promise();
      domainName = cloudFrontDistribution.Distribution.DomainName;
      process.env.SecretPem = project.contentDeliveryNetwork.secretPem;
      process.env.PemID = publicKey.Id;
      process.env.Host = domainName;
      token = await CloudFrontTokenGen.signPath('test');
      expect(token).not.toBe(undefined);
    }));
  });

  test('Should return 200 HTTP status code', async () => {
    if (projectNames.length === 0) {
      console.log('No VoD projects found, passing to next tests');
      return;
    }
    await request(`https://${domainName}`).get(`/test/test.png${token}`).expect(200);
  });

  test('Should return 403 HTTP status code', async () => {
    if (projectNames.length === 0) {
      console.log('No VoD projects found, passing to next tests');
      return;
    }
    await request(`https://${domainName}`).get('/test/test.png').expect(403);
  });
});
