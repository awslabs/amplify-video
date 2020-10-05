function generateIAMAdmin(resourceName, bucketName) {
  const admin = {
    groupName: 'Admin',
    precedence: 1,
    customPolicies: [],
  };
  admin.customPolicies.push(generateIAMAdminPolicy(resourceName, bucketName));
  return admin;
}

function generateIAMAdminPolicy(resourceName, bucketName) {
  const adminPolicy = {
    PolicyName: `${resourceName}-admin-group-policy`,
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
  return adminPolicy;
}

module.exports = {
  generateIAMAdmin,
  generateIAMAdminPolicy,
};
