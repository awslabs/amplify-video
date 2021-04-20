const fs = require('fs');
const ejs = require('ejs');

let fullCoverage = false;

const servicesQuestions = [];
const servicesHelpers = {};

const supportedServices = require(`${__dirname}/../../provider-utils/supported-services.json`);
const helpersFolder = `${__dirname}/test-helpers/`;
Object.keys(supportedServices).forEach((key) => {
  servicesQuestions.push({
    serviceType: `${key}`,
    provider: `${supportedServices[key].questionFilename}`,
  });
  servicesHelpers[key] = require(`${helpersFolder}${key}-helpers.json`);
});

class TreeNode {
  constructor(value, key, depth) {
    this.key = key;
    this.value = value;
    this.depth = depth;
    this.parents = [];
    this.childs = [];
  }

  addChild(newNode) {
    this.childs = [...this.childs, newNode];
    newNode.parents = [...newNode.parents, this];
    return newNode;
  }
}

class Tree {
  constructor(serviceType, provider) {
    this.serviceType = serviceType;
    this.provider = provider;
    this.maxDepth = 0;
    this.paths = [];
  }

  buildTree(helper) {
    const getNextNode = (currNode, currQuestion, depth) => {
      depth++;
      this.maxDepth = depth;
      if (typeof currQuestion === 'undefined'
        || (!!currQuestion.next && !!currQuestion.options && currQuestion.type !== 'checkbox')) {
        return;
      }
      if (!!currQuestion.type && currQuestion.type === 'list') {
        Object.keys(currQuestion.options).forEach((optionKey) => {
          if (currQuestion.options[optionKey].ignore === true && !fullCoverage) {
            return;
          }
          if (!currQuestion.options[optionKey].next) {
            currNode.addChild(new TreeNode(currQuestion.options[optionKey].value || '',
              currQuestion.key, depth));
          } else {
            currQuestion.options[optionKey].next.split('||').forEach((next) => {
              const nextNode = new TreeNode(currQuestion.options[optionKey].value || '',
                currQuestion.key, depth);
              currNode.addChild(nextNode);
              getNextNode(nextNode, helper[next],
                depth);
            });
          }
        });
      } else if (!!currQuestion.type && currQuestion.type === 'confirm') {
        currQuestion.options.forEach((option) => {
          if (option.ignore === true && !fullCoverage) {
            return;
          }
          if (!option.next) {
            const nextNode = new TreeNode(option.value, currQuestion.key, depth);
            currNode.addChild(nextNode);
          } else {
            option.next.split('||').forEach((next) => {
              const nextNode = new TreeNode(option.value, currQuestion.key, depth);
              currNode.addChild(nextNode);
              getNextNode(nextNode, helper[next], depth);
            });
          }
        });
      } else if (!!currQuestion.type && currQuestion.type === 'checkbox') {
        const getCombinations = (array) => {
          const result = [];
          const fGetCombinations = (prefix, arr) => {
            for (let i = 0; i < arr.length; i++) {
              result.push(`${prefix},${arr[i]}`);
              fGetCombinations(`${prefix},${arr[i]}`, arr.slice(i + 1));
            }
          };
          fGetCombinations('', array);
          return result.map(r => r.slice(1, r.length)).map(r => r.split(','));
        };
        getCombinations(currQuestion.options).forEach((combinaison) => {
          const nextNode = new TreeNode(combinaison || '',
            currQuestion.key, depth);
          currNode.addChild(nextNode);
          getNextNode(nextNode, helper[currQuestion.next], depth);
        });
      } else if (currQuestion.next) {
        currQuestion.next.split('||').forEach((next) => {
          const nextNode = new TreeNode(helper[currQuestion.key].value || '',
            currQuestion.key, depth);
          currNode.addChild(nextNode);
          getNextNode(nextNode, helper[next], depth);
        });
      } else {
        currNode.addChild(new TreeNode(helper[currQuestion.key].value || '',
          currQuestion.key, depth));
      }
    };

    this.rootNode = new TreeNode('root', 'root', 0);
    const firstQuestion = helper.resourceName;
    const firstNode = new TreeNode(firstQuestion.value, 'resourceName', 1);
    this.rootNode.addChild(firstNode);
    getNextNode(firstNode, helper[firstQuestion.next], firstNode.depth);
    return this;
  }

  buildPaths(node, path) {
    if (node.parents.length === 0) {
      this.paths = [...this.paths, [...path]];
      return;
    }
    if (node.key !== 'root') {
      path = [...path, { key: node.key, value: node.value }];
    }
    node.parents.forEach((c) => {
      this.buildPaths(c, [...path]);
    });
  }

  getBottomNodes(node, arr) {
    if (node.childs.length === 0) {
      arr.push(node);
    } else {
      node.childs.forEach(child => this.getBottomNodes(child, arr));
    }
  }

  buildScript() {
    this.paths.forEach((path, idx) => {
      ejs.renderFile(`${__dirname}/template.ejs`, {
        payload: {
          inputs: path,
          serviceType: this.serviceType,
          provider: this.provider,
        },
      }, (ejsErr, str) => {
        if (ejsErr) {
          console.error(ejsErr);
          return;
        }
        fs.writeFile(`${__dirname}/output/${this.serviceType}-${idx}.sh`, str, (fsErr) => {
          if (fsErr) {
            console.error(fsErr);
          }
        });
      });
    });
  }
}

if (process.argv.length !== 3 && process.argv.length !== 2) {
  console.info("Arguments should be 'node index.js [full-coverage]");
  process.exit(1);
}

fullCoverage = process.argv[2] === 'full-coverage';

console.info('\nGenerating script files...');

servicesQuestions.forEach((question) => {
  if (['livestream', 'ivs', 'video-on-demand'].includes(question.serviceType)) {
    const tree = new Tree(question.serviceType, question.provider);
    tree.buildTree(servicesHelpers[`${question.serviceType}`]);
    const bottomNodes = [];
    tree.getBottomNodes(tree.rootNode, bottomNodes);
    bottomNodes.forEach(node => tree.buildPaths(node, []));
    tree.paths.forEach((path) => {
      path.forEach((elem) => {
        if (elem.key === 'resourceName') {
          elem.value += `${Math.random().toString(36).substring(2, 6)}`;
        }
      });
    });
    tree.buildScript();
    console.info(`Generated ${tree.paths.length} scripts for ${question.serviceType} service`);
  }
});
