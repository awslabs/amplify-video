/* eslint-disable guard-for-in */
/* eslint-disable no-restricted-syntax */
const fs = require('fs');

const newEnvName = 'tonia';
const resourceDirectoryFiles = fs.readdirSync(
  `${__dirname}/`,
);

// Check if env-specific props file already exists
const hasOwnEnvProps = resourceDirectoryFiles.includes(`${newEnvName}-props.json`);

// Check if ANY env props exist
const hasAnyEnvProps = resourceDirectoryFiles.find(item => item.includes('-props.json'));

// console.log('hasOwnEnv', hasOwnEnvProps);
// console.log('hasAnyEnvProps', hasAnyEnvProps);

if (!hasOwnEnvProps) {
  if (hasAnyEnvProps) {
    // take the first props file you find and copy that!
    const propsFilenameToCopy = resourceDirectoryFiles.filter(propsFileName => propsFileName.includes('-props.json'))[0];
    const envNameToReplace = propsFilenameToCopy.substr(0, propsFilenameToCopy.indexOf('-'));
    const propsToMutate = JSON.parse(fs.readFileSync(`${__dirname}/${propsFilenameToCopy}`));

    const searchAndReplaceProps = () => {
      const newPropsObj = {};
      for (const [key, value] of Object.entries(propsToMutate.contentDeliveryNetwork)) {
        if (typeof value === 'string' && value.includes(`${envNameToReplace}`)) {
          const newValue = value.replace(new RegExp(envNameToReplace, 'g'), `${newEnvName}`);
          newPropsObj[key] = newValue;
        } else {
          newPropsObj[key] = value;
        }
      }
      return newPropsObj;
    };

    const newPropsToSave = Object.assign(
      propsToMutate, { contentDeliveryNetwork: searchAndReplaceProps() },
    );

    console.log('IM GONNA SAVE THIS, ', newPropsToSave);

    fs.writeFileSync(`${__dirname}/${newEnvName}-props.json`, JSON.stringify(newPropsToSave, null, 4));
  }
}
