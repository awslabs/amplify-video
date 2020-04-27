const url = require('url');
/* eslint-disable */
const aws = require('aws-sdk');
var globalPem;
/* eslint-enable */

exports.handler = async (event) => {
  const response = await signPath(event.source.id);
  return response;
};

async function sign(pathURL) {
  const epoch = Math.floor(new Date(new Date().getTime() + (3600 * 1000)).getTime() / 1000);
  const mkSignPolicy = `{"Statement":[{"Resource":"${pathURL}","Condition":{"DateLessThan":{"AWS:EpochTime":${epoch}}}}]}`;
  if (globalPem === undefined) {
    await getPemKey(process.env.SecretPem);
  }
  const signer = new aws.CloudFront.Signer(process.env.PemID, globalPem);
  const params = {};
  params.url = pathURL;
  params.policy = mkSignPolicy;

  return signer.getSignedUrl(params);
}

async function getPemKey(pemId) {
  const secretsManager = new aws.SecretsManager({ apiVersion: '2017-10-17' });
  const secret = await secretsManager.getSecretValue({ SecretId: pemId }).promise();
  globalPem = secret.SecretBinary;
}


async function signPath(id) {
  /* use wildcard if no specific file is specified */
  const videoPath = `${id}/*`;
  const host = process.env.Host;
  const tobeSigned = url.format({
    protocol: 'https:', slashes: true, host, pathname: videoPath,
  });
  const signedUrl = await sign(tobeSigned);
  const urlParams = signedUrl.replace(`https://${host}/${videoPath}`, '');

  return urlParams;
}
