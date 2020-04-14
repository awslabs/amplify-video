# Contribution Guidelines

Thank you for your interest in contributing to Amplify Video. Whether it's a bug report, new feature, correction, or additional documentation, we greatly value feedback and contributions from our community.

Please read through this document before submitting any issues or pull requests to ensure we have all the necessary 
information to effectively respond to your bug report or contribution.

## Reporting Bugs/Feature Requests

We welcome you to use the GitHub issue tracker to report bugs or suggest features.

When filing an issue, please check [existing open](https://github.com/awslabs/amplify-video/issues), or [recently closed](https://github.com/awslabs/amplify-video/issues?utf8=%E2%9C%93&q=is%3Aissue%20is%3Aclosed%20), issues to make sure somebody else hasn't already 
reported the issue. Please try to include as much information as you can. Details like these are incredibly useful:

* A reproducible test case or series of steps
* The version of our code being used
* Any modifications you've made relevant to the bug
* Anything unusual about your environment or deployment

## Finding Contribution Opportunities

Looking at the existing issues is a great way to find something to contribute. This project uses the default GitHub issue labels (enhancement/bug/duplicate/help wanted/invalid/question/wontfix), so looking at any ['help wanted'](https://github.com/awslabs/amplify-video/labels/help%20wanted) issues is a great place to start.


## Pull Requests

Pull requests are welcome!

Unless it's a trivial change, you should open an issue to discuss your pull request with the maintainers. This helps to ensure that the proposed change would be accepted and that you don't waste your own time. If you would like to implement support for a significant feature that is not yet available, please talk to us beforehand to avoid any duplication of effort.

 Before sending us a pull request, please ensure that:

1. You are working against the latest source on the *master* branch.
2. You check existing open, and recently merged, pull requests to make sure someone else hasn't addressed the problem already.
3. You open an issue to discuss any significant work - we would hate for your time to be wasted.

To send us a pull request, please:

1. Fork the repository.
2. Modify the source; please focus on the specific change you are contributing. If you also reformat all the code, it will be hard for us to focus on your change. Eslint should always be run before submitting new pull requests by running `npm run lint-fix`. This should correct any naming conventions and covert spaces/tabs to the preferred defaults.
3. Ensure local tests pass.
4. Commit to your fork using clear commit messages.
5. Send us a pull request, answering any default questions in the pull request interface.
6. Pay attention to any automated CI failures reported in the pull request, and stay involved in the conversation.

GitHub provides additional document on [forking a repository](https://help.github.com/articles/fork-a-repo/) and 
[creating a pull request](https://help.github.com/articles/creating-a-pull-request/).

## Understanding the codebase

The following is a description of the Amplify Video project structure.

### Root

`./index.js`

Contains the callback functions for amplify for pre/post push.

`./amplify-plugin.json`

Contains all supported plugin commands

### Provider Utilities and CloudFormation

`./provider-utils/supported-services.json`

Defines workflows that are supported by amplify video. Required files are:

* `alias` : What shows up in the question
* `serviceWalkthroughFilename` : What asks the questions for that specific service
* `cfnFilename` : The root template for the service
* `stackFolder` : Contains supporting templates for the service
* `defaultValuesFilename` : Contains default answers to the questions asked in `serviceWalkthroughFilename`
* `provider` : Define what provider you want to use. This maps to the containing folder for the rest of the files. (Right now the Amplify CLI only supports CloudFormation)


`./provider-utils/awscloudformation/index.js`

This file takes the info passed from the servicewalkthrough file and executes it. This file shouldn't be changed that often.

`./provider-utils/awscloudformation/utils/`

Contains all functions that are shared between all video services with respect to CloudFormation

`./provider-utils/awscloudformation/service-walkthroughs/`

Contains the service walkthrough file that is defined in the `supported-services.json`. These files prompt the user questions about the Video resource.

`./provider-utils/awscloudformation/obs-templates/`

The template for amplify video livestream to configure OBS

`./provider-utils/awscloudformation/default-values/`

Place your defaults value file here that you defined above in the supported-services.json

`./provider-utils/awscloudformation/cloudformation-templates/`

Place your root template here and your folder for your nested stack. You will notice that the templates that already exist for the root stack are .ejs files. EJS allows us to dynamically compile the CloudFormation to add or remove features and passing parameters generated from the CLI. Any folders inside of the nested stack folder will be zipped up and given the same name in .zip on pre push.

### Commands

`./commands/video.js`

Contains the help view for amplify video. Any new commands should show up here.

`./commands/video/`

Contains all supported commands defined in the amplify-plugin.json

## Manually installing

Manual installation of Amplify Video can be useful for development purposes.

1. Clone this repo onto your local machine
1. Open the terminal and navigate to the repo you just cloned
1. Run this command: 
```
npm install -g
```

### Commit Style

Current version: `Release`

Using Cloudformation to deploy elemental: `False`

Version number meaning: `x.y.z`

`x` is major
`y` is minor
`z` is maintenance

Commit messages must follow:

```
Release vx.y.z
    
Initial plugin to create the elemental resources to host a AWS Video Services

- (Changes in details)

Please note this uses lambda functions to deploy the resources as there is no cloudformation support for elemental yet.
```

## Code of Conduct

This project has adopted the [Amazon Open Source Code of Conduct](https://aws.github.io/code-of-conduct). 
For more information see the [Code of Conduct FAQ](https://aws.github.io/code-of-conduct-faq) or contact 
opensource-codeofconduct@amazon.com with any additional questions or comments.

## Security issue notifications

If you discover a potential security issue in this project we ask that you notify AWS/Amazon Security via our [vulnerability reporting page](http://aws.amazon.com/security/vulnerability-reporting/). Please do **not** create a public github issue.

## Licensing

See the [LICENSE](https://github.com/awslabs/amplify-video/blob/master/LICENSE) file for our project's licensing. We will ask you to confirm the licensing of your contribution.

We may ask you to sign a [Contributor License Agreement (CLA)](http://en.wikipedia.org/wiki/Contributor_License_Agreement) for larger changes.
