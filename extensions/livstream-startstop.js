const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs');
const {copyFilesToLocal, copyFilesToS3} = require('./livestream-push');

module.exports = context => {
  context.startStream = async () => {
    let options = {
      service: 'Elemental',
      providerPlugin: 'awscloudformation',
      start: true
    };
    await startStop(context, options)
  }
  context.stopStream = async () => {
    let options = {
      service: 'Elemental',
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
    if (!amplifyMeta.Elemental){
      chalk.bold("You have no Elemental projects.");
    }
    const chooseProject = [
      {
        type: 'list',
        name: 'resourceName',
        message: `Choose what project you want to ${ options.start ? 'start' : 'stop'}?`,
        choices: Object.keys(amplifyMeta.Elemental),
        default: Object.keys(amplifyMeta.Elemental)[0],
      }
    ];
  
    if(!amplify.Elemental && Object.keys(amplifyMeta.Elemental).length != 0){
      project = await inquirer.prompt(chooseProject);
      if (amplifyMeta.Elemental[project.resourceName].output){
        const targetDir = amplify.pathManager.getBackendDirPath();
        try {
            let props = JSON.parse(fs.readFileSync(`${targetDir}/Elemental/${project.resourceName}/props.json`));
            if ( (props.mediaLive.autoStart === 'YES' && !options.start) || (props.mediaLive.autoStart === 'NO' && options.start) ){
                props.mediaLive.autoStart = options.start ? 'YES' : 'NO';
                await context.updateWithProps(context, options, props);
                amplify.pushResources(context, 'Elemental', project.resourceName).catch((err) => {
                    context.print.info(err.stack);
                    context.print.error('There was an error pushing the Elemental resource');
                });
            } else {
                console.log(chalk`{bold ${project.resourceName} is already ${options.start ? 'running' : 'stopped'}.}`);
            }
        } catch (err){
            console.log(err);
        //Do nothing
        }
        //await prettifyOutput(amplifyMeta.Elemental[project.resourceName].output, project.resourceName);
      } else {
        console.log(chalk`{bold You have not pushed ${project.resourceName} to the cloud yet.}`);
      }
    } else {
      console.log(chalk.bold("You have no Elemental projects."));
      return;
    }
  }    
}