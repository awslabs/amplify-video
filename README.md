# Amplify Elemental Plugin

Welcome to the first 3rd party plugin for Amplify that supports setting up Elemental services.

## Installation Guide

To get started with installing make sure you have installed the Amplify CLI.


Please refer to the getting started guide on their [Github repo](https://github.com/aws-amplify/amplify-cli/).


After installing the official CLI you now have to install this on your local machine. Their are two methods for doing this.

### NPM Installation guide

TODO

### Manually installing

1. Clone this repo onto your local machine
1. Open the terminal and navigate to the repo you just cloned
1. Run this command: 
```
npm install --save-dev amplify-elemental-plugin
```


## Usage

To use this plugin you just need to configure a project using `amplify init`.

Note:If you aren't developing a mobile app then it doesn't matter what language you choose.

Once you have a project configured then run `amplify livestream add` and follow the prompts.

To deploy the project to the cloud run `amplify push`