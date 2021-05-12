const ivs = require('../provider-utils/awscloudformation/service-walkthroughs/ivs-push');
const livestream = require('../provider-utils/awscloudformation/service-walkthroughs/ivs-push');

const context = {
  amplify: {
    getProjectMeta: jest.fn(() => ({
      providers: {
        awscloudformation: {
          DeploymentBucketName: 'test',
        },
      },
    })),
    inputValidation: jest.fn(() => true),
  },
  parameters: {
    options: {

    },
  },
};

test('Should return the default props with correct resource name for IVS', async () => {
  const { shared } = await ivs.serviceQuestions(context, '', '', 'ivs');
  expect(shared).toMatchObject({
    resourceName: 'ivs',
    bucket: 'test',
  });
});

test('Should return the default props with correct resource name for Elemental Livestream service', async () => {
  const { shared } = await livestream.serviceQuestions(context, '', '', 'elemental');
  expect(shared).toMatchObject({
    resourceName: 'elemental',
    bucket: 'test',
  });
});
