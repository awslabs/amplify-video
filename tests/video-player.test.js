const videoPlayerUtils = require('../provider-utils/awscloudformation/utils/video-player-utils');

const mocks = {
  podfile: {
    target_definitions: [
      {
        name: 'Pods',
        abstract: true,
        children: [
          {
            name: 'iOSVideoPlayer',
            uses_frameworks: { linkage: 'dynamic', packaging: 'framework' },
            platform: { ios: '8.4' },
            dependencies: [{ MobileVLCKit: ['~>3.3.0'] }],
          },
        ],
      },
    ],
  },
  podfile_no_dep: {
    target_definitions: [
      {
        name: 'Pods',
        abstract: true,
        children: [
          {
            name: 'iOSVideoPlayer',
            uses_frameworks: { linkage: 'dynamic', packaging: 'framework' },
          },
        ],
      },
    ],
  },

};

describe('isVLCKitInstalled', () => {
  test('Should return true if VLCKit is installed', () => {
    expect(videoPlayerUtils.isVLCKitInstalled(mocks.podfile, 'iOSVideoPlayer')).toBe(true);
  });

  test('Should return false if project name does not exist', () => {
    expect(videoPlayerUtils.isVLCKitInstalled(mocks.podfile, 'anotherProjectName')).toBe(false);
  });

  test('Should return false dependencies array does not exist', () => {
    expect(videoPlayerUtils.isVLCKitInstalled(mocks.podfile_no_dep, 'iOSVideoPlayer')).toBe(false);
  });
});

describe('checkNpmDependencies', () => {
  test('Should return true if video.js is installed', () => {
    const context = {
      amplify: {
        pathManager: {
          searchProjectRootPath: jest.fn(() => `${__dirname}/../__mocks__`),
        },
      },
    };
    expect(videoPlayerUtils.checkNpmDependencies(context, 'video.js')).toBe(true);
  });

  test('Should return false if dependency is not installed', () => {
    const context = {
      amplify: {
        pathManager: {
          searchProjectRootPath: jest.fn(() => `${__dirname}/../__mocks__`),
        },
      },
    };
    expect(videoPlayerUtils.checkNpmDependencies(context, 'random_lib')).toBe(false);
  });
});

describe('getServiceUrl', () => {
  test('Should return livestream oPrimaryMediaStoreEgressUrl', () => {
    const amplifyVideoMeta = {
      serviceType: 'livestream',
      output: {
        oPrimaryMediaStoreEgressUrl: 'test',
      },
    };
    expect(videoPlayerUtils.getServiceUrl(amplifyVideoMeta)).toBe('test');
  });

  test('Should return ivs oVideoOutput', () => {
    const amplifyVideoMeta = {
      serviceType: 'ivs',
      output: {
        oVideoOutput: 'test',
      },
    };
    expect(videoPlayerUtils.getServiceUrl(amplifyVideoMeta)).toBe('test');
  });

  test('Should return vod oVideoOutput', () => {
    const amplifyVideoMeta = {
      serviceType: 'video-on-demand',
      output: {
        oVodOutputUrl: 'test',
      },
    };
    expect(videoPlayerUtils.getServiceUrl(amplifyVideoMeta)).toBe('https://test/{path}/{path.m3u8}');
  });

  test('Should return vod oVODOutputS3', () => {
    const amplifyVideoMeta = {
      serviceType: 'video-on-demand',
      output: {
        oVODOutputS3: 'test',
      },
    };
    expect(videoPlayerUtils.getServiceUrl(amplifyVideoMeta)).toBe('test');
  });

  test('Should return undefined', () => {
    const amplifyVideoMeta = {
      serviceType: '',
    };
    expect(videoPlayerUtils.getServiceUrl(amplifyVideoMeta)).toBe(undefined);
  });
});

describe('fileExtension', () => {
  test('Should return jsx for react', () => {
    expect(videoPlayerUtils.fileExtension('react')).toBe('jsx');
  });

  test('Should return vue for vue', () => {
    expect(videoPlayerUtils.fileExtension('vue')).toBe('vue');
  });

  test('Should return ts for angular', () => {
    expect(videoPlayerUtils.fileExtension('angular')).toBe('ts');
  });

  test('Should return js for ember', () => {
    expect(videoPlayerUtils.fileExtension('ember')).toBe('js');
  });

  test('Should return ts for ionic', () => {
    expect(videoPlayerUtils.fileExtension('ionic')).toBe('ts');
  });

  test('Should return swift for ios', () => {
    expect(videoPlayerUtils.fileExtension('ios')).toBe('swift');
  });
});
