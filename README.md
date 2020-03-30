# Amplify Video Plugin
<p>
  <a href="https://www.npmjs.com/package/amplify-category-video">
      <img src="https://img.shields.io/npm/v/amplify-category-video.svg" />
  </a>
</p>

An open source plugin for the Amplify CLI that makes it easy to incorporate video streaming into your mobile and web applications powered by [AWS Amplify](https://aws-amplify.github.io/) and [AWS Media Services](https://aws.amazon.com/media-services/)

Read more about Amplify Video on the [AWS Media Blog](https://aws.amazon.com/blogs/media/introducing_aws_amplify_video/)

## Installation

Amplify Video is [Plugin for AWS Amplify](https://aws-amplify.github.io/docs/cli-toolchain/plugins?sdk=js) that provides video streaming resources to your Amplify project. It requires that you have the Amplify CLI installed on your system before installing the Amplify Video plugin

To get started install the Amplify CLI via NPM as shown below or follow the [getting started guide](https://github.com/aws-amplify/amplify-cli/).


``` 
npm install -g @aws-amplify/cli
amplify configure
```

Next, with the Amplify CLI installed, install this plugin:

```
npm i amplify-category-video -g
```

## Getting Started with Amplify Video

To help you get started quickly with Amplify Video check out the [live streaming quickstart](live-quickstart.md)

## Usage

To use this plugin you just need to configure a project using `amplify init`.

Note: If you aren't developing a mobile/web app then it doesn't matter what language you choose.


### amplify video add

Command to configure the params for setting up a livestream. Run `amplify video push` or `amplify push` to create the resources in the cloud.

### amplify video update

Command to update your params for your video setup.

### amplify video start

Command to start your video stream.

### amplify video stop

Command to stop your video stream.

### amplify video setup

Command to repush the CloudFormation dependancies to the S3.

### amplify video push

Command to push a specific video project.

### amplify video get-info

Command to return the CloudFormation outputs.

### amplify video setup-obs

Command to create and import a preconfigured OBS profile.

### amplify video remove

Command to remove a project that you have made. To remove from the cloud you must run `amplify video push` or `amplify push`

## Manually installing

1. Clone this repo onto your local machine
1. Open the terminal and navigate to the repo you just cloned
1. Run this command: 
```
npm install -g
```

## License

This library is licensed under the Apache 2.0 License. 
