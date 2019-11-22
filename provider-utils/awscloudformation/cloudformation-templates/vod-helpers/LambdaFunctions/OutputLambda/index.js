/* eslint-disable */
const AWS = require('aws-sdk');
/* eslint-enable */
const s3 = new AWS.S3({});

/* eslint-disable */
exports.handler = function (event, context) {
/* eslint-enable */
  event.Records.forEach((s3Record) => {
    console.log(s3Record.s3.object.key);
    const objectKey = s3Record.s3.object.key;
    const bucketName = s3Record.s3.bucket.name;
    const params = {
      Bucket: bucketName,
      Key: objectKey,
      ACL: 'public-read',
    };
    s3.putObjectAcl(params, (err, data) => {
      if (err) {
        console.log(err);
      } else {
        console.log(data);
      }
    });
  });
};
