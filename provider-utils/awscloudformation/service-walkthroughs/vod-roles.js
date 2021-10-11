function generateIAMGroupPolicy(resourceName, groupName, bucketName) {
  const groupPolicy = {
    PolicyName: `${resourceName}-vod-${groupName.toLowerCase()}-group-policy`,
    PolicyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'VisualEditor0',
          Effect: 'Allow',
          Action: [
            's3:PutObject',
            's3:DeleteObject',
          ],
          Resource: `arn:aws:s3:::${bucketName}/*`,
        },
      ],
    },
  };
  return groupPolicy;
}

module.exports = {
  generateIAMGroupPolicy,
};
