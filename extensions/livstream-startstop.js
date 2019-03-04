const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs');
const {copyFilesToLocal, copyFilesToS3} = require('./livestream-push');

module.exports = context => {
  context.startStream = async () => {
    let options = {
      service: 'video',
      providerPlugin: 'awscloudformation',
      start: true
    };
    await startStop(context, options)
  }
  context.stopStream = async () => {
    let options = {
      service: 'video',
      providerPlugin: 'awscloudformation',
      start: false
    };
    await startStop(context, options)
  }
}

async function startStop(context, options){
    const { amplify } = context;
    let project;
    let debug = false;
    const amplifyMeta = context.amplify.getProjectMeta();
    if (debug == true){
      return;
    } else {
    if (!amplifyMeta.video){
      chalk.bold("You have no video projects.");
    }
    const chooseProject = [
      {
        type: 'list',
        name: 'resourceName',
        message: `Choose what project you want to ${ options.start ? 'start' : 'stop'}?`,
        choices: Object.keys(amplifyMeta.video),
        default: Object.keys(amplifyMeta.video)[0],
      }
    ];
  
    if(!amplify.video && Object.keys(amplifyMeta.video).length != 0){
      project = await inquirer.prompt(chooseProject);
      if (amplifyMeta.video[project.resourceName].output){
        const targetDir = amplify.pathManager.getBackendDirPath();
        try {
            let props = JSON.parse(fs.readFileSync(`${targetDir}/video/${project.resourceName}/props.json`));
            if ( (props.mediaLive.autoStart === 'YES' && !options.start) || (props.mediaLive.autoStart === 'NO' && options.start) ){
                props.mediaLive.autoStart = options.start ? 'YES' : 'NO';
                await context.updateWithProps(context, options, props);
                amplify.pushResources(context, 'video', project.resourceName).catch((err) => {
                    context.print.info(err.stack);
                    context.print.error('There was an error pushing the video resource');
                });
            } else {
                console.log(chalk`{bold ${project.resourceName} is already ${options.start ? 'running' : 'stopped'}.}`);
            }
        } catch (err){
            console.log(err);
        //Do nothing
        }
        //await prettifyOutput(amplifyMeta.video[project.resourceName].output, project.resourceName);
      } else {
        console.log(chalk`{bold You have not pushed ${project.resourceName} to the cloud yet.}`);
      }
    } else {
      console.log(chalk.bold("You have no video projects."));
      return;
    }
  }    
}