module.exports = {
 name: 'push',
 run: async (context) => {
   const { amplify, parameters } = context;

   let answer;
   const chooseProject = [
     {
       type: 'list',
       name: 'resourceName',
       message: 'Choose what project you want to update?',
       choices: Object.keys(context.amplify.getProjectMeta().Elemental),
       default: Object.keys(context.amplify.getProjectMeta().Elemental)[0],
     }
   ];

   answer = await inquirer.prompt(chooseProject);

   return amplify.pushResources(context, 'Elemental', answer.resourceName)
         .catch((err) => {
        context.print.info(err.stack);
        context.print.error('There was an error pushing the API resource');
   });
 }
}