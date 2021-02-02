const { serviceQuestions } = require('../provider-utils/awscloudformation/service-walkthroughs/ivs-push');

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

test('Should return the default props with test resource name', async () => {
  const { shared } = await serviceQuestions(context, '', '', 'test');
  expect(shared).toMatchObject({
    resourceName: 'test',
    bucket: 'test',
  });
});
