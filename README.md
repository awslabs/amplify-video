# Amplify Video Plugin

Welcome to the first 3rd party plugin for Amplify that supports setting up AWS Video Services.

## Installation Guide

To get started with installing make sure you have installed the Amplify CLI.


Please refer to the getting started guide on their [Github repo](https://github.com/aws-amplify/amplify-cli/).


After installing the official CLI you now have to install this on your local machine. Their are two methods for doing this.

### NPM Installation guide

```
npm i amplify-category-video -g
```

### Manually installing

1. Clone this repo onto your local machine
1. Open the terminal and navigate to the repo you just cloned
1. Run this command: 
```
npm install -g
```


## Usage

To use this plugin you just need to configure a project using `amplify init`.

Note: If you aren't developing a mobile/web app then it doesn't matter what language you choose.


### amplify video add

Command to configure the params for setting up a livestream. Run `amplify video push` or `amplify push` to create the resources in the cloud.

### amplify video update

Command to update your params for your video setup

### amplify video start

Command to start your video stream

### amplify video stop

Command to stop your video stream

### amplify video setup

Command to repush the CloudFormation dependancies to the S3.

### amplify video push

Command to push a specific video project.

### amplify video get-info

Command to return the CloudFormation outputs.

### amplify video remove

Command to remove a project that you have made. To remove from the cloud you must run `amplify livestream push` or `amplify push`

## License

This library is licensed under the Apache 2.0 License. 
