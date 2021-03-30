const { spawn } = require('child_process');

function autoAnswer({
  context, answers, key, value,
}) {
  if (context.parameters.options.payload) {
    answers[key] = value;
  } else {
    return true;
  }
}

async function exec(command, args, verbose = true) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(command, args);

    childProcess.stdout.on('data', (stdout) => {
      if (verbose) {
        console.log(stdout.toString());
      }
    });

    childProcess.stderr.on('data', (stderr) => {
      console.log(stderr.toString());
    });

    childProcess.on('close', async (code) => {
      if (verbose) {
        console.log(`child process exited with code ${code}`);
      }
      if (code !== 0) {
        reject(new Error('Something went wrong, check above'));
      }
      resolve();
    });
  });
}

module.exports = {
  autoAnswer,
  exec,
};
