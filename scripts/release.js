const inquirer = require('inquirer');
const fs = require('fs');
const serviceMetadata = JSON.parse(fs.readFileSync(`${__dirname}/../package.json`));
const metaSplit = serviceMetadata.version.split('.');
const versionBump = `${metaSplit[0]}.${metaSplit[1]}.${parseInt(metaSplit[2]) + 1}`;

const versionQuestion = [
  {
    name: 'version',
    message: `Please provide a new version: (Current is ${serviceMetadata.version}):`,
    validate: function (input) {
      console.log('\n' + input);
      const regex = new RegExp('^(\\d+\\.)?(\\d+\\.)?(\\*|\\d+)$');
      let regexValidate = regex.test(input);
      if (regexValidate) {
        const inputSplit = input.split('.');
        //Confirm that the version is above:
        let versionGreater = false;
        for (let i = 0; i < inputSplit.length; i++) {
          if( inputSplit[i] === '*' || parseInt(inputSplit[i]) > parseInt(metaSplit[i])){
            versionGreater = true;
            break;
          }
        }
        return versionGreater ? true : 'Version is not greater then current version';
      }
      return 'Invalid Version Provided';
    },
    default: versionBump,
  }];

inquirer.prompt(versionQuestion).then(answers => {
  let version = answers.version;
  const versionSplit = version.split('.');
  const position = versionSplit.findIndex((element) => element === '*');
  if (position != -1){
    versionSplit[position] = (parseInt(metaSplit[position]) + 1).toString();
    for (let i = position+1; i < 3; i++){
      versionSplit[i] = '0';
    }
    version = versionSplit.join('.');
  }
  console.log(`New version is: ${version}`);
}).catch(e => console.log(e));