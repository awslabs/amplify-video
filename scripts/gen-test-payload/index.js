const fs = require('fs');
const ejs = require('ejs');

const servicesQuestions = [];
const servicesHelpers = {};

const questionFolder = `${__dirname}/../../provider-utils/`;
fs.readdirSync(questionFolder).forEach((file) => {
  if (file.includes('questions')) {
    servicesQuestions.push({
      serviceType: file.split('-')[0],
      content: require(`${questionFolder}${file}`),
    });
  }
});

const helpersFolder = './test-helpers/';
fs.readdirSync(helpersFolder).forEach((file) => {
  if (file.includes('helpers')) {
    servicesHelpers[file.split('-')[0]] = require(`${helpersFolder}${file}`);
  }
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
  constructor() {
    this.maxDepth = 0;
    this.paths = [];
  }

  buildTree(questions, helper) {
    const getNextNode = (currNode, currQuestion, depth) => {
      depth++;
      if (typeof currQuestion === 'undefined' || (!!currQuestion.next && !!currQuestion.options) || (typeof currQuestion.ignore !== 'undefined')) {
        return;
      }
      if (!!currQuestion.type && currQuestion.type === 'list') {
        Object.keys(currQuestion.options).forEach((optionKey) => {
          if (currQuestion.options[optionKey].ignore === true) {
            return;
          }
          if (!currQuestion.options[optionKey].next) {
            currNode.addChild(new TreeNode(currQuestion.options[optionKey].value,
              currQuestion.key, depth));
          } else {
            const nextNode = new TreeNode(currQuestion.options[optionKey].value,
              currQuestion.key, depth);
            currNode.addChild(nextNode);
            getNextNode(nextNode, helper[currQuestion.options[optionKey].next],
              depth);
          }
        });
      } else if (!!currQuestion.type && currQuestion.type === 'confirm') {
        // don't create node out of those because they don't hold payload
        // they might hold one but we have no example for that
        getNextNode(currNode, helper[currQuestion.yesNext], depth); // yes
        getNextNode(currNode, helper[currQuestion.noNext], depth); // no
      } else if (!!currQuestion.type && currQuestion.type === 'checkbox') {
        // gen all permutations of checkboxes and call getNextNode for each of them
      } else {
        const nextNode = new TreeNode(helper[currQuestion.key].defaultValue,
          currQuestion.key, depth);
        currNode.addChild(nextNode);
        getNextNode(nextNode, helper[currQuestion.next], depth);
      }
    };

    this.rootNode = new TreeNode('root', 'root', 0);
    const firstQuestion = helper[questions.content.video.inputs[0].key];
    const firstNode = new TreeNode(helper[questions.content.video.inputs[0].key].defaultValue,
      questions.content.video.inputs[0].key, 1);
    this.rootNode.addChild(firstNode);
    getNextNode(firstNode, helper[firstQuestion.next], firstNode.depth);
    return this;
  }

  buildPaths(node, path, helpers) {
    if (node.childs.length === 0) {
      path = [...path, { key: node.key, value: node.value }];
      this.paths = [...this.paths, path];
      return;
    }
    if (node.key !== 'root') {
      path = [...path, { key: node.key, value: node.value }];
    }
    node.childs.forEach((c) => {
      this.buildPaths(c, path, helpers);
    });
  }

  buildScript(questions) {
    this.paths.forEach((path, idx) => {
      ejs.renderFile('./template.ejs', {
        payload: {
          inputs: path,
          serviceType: questions.serviceType,
          provider: questions.content.video.provider,
        },
      }, (ejsErr, str) => {
        if (ejsErr) {
          console.error(ejsErr);
          return;
        }
        fs.writeFile(`output/${questions.serviceType}-${idx}.sh`, str, (fsErr) => {
          if (fsErr) {
            console.error(fsErr);
          }
        });
      });
    });
  }
}

// Entrypoint (node index.js)
servicesQuestions.forEach((question) => {
  if (question.serviceType === 'livestream' || question.serviceType === 'ivs') {
    console.info(`---Service ${question.serviceType}---`);
    const tree = new Tree();
    tree.buildTree(question, servicesHelpers[`${question.serviceType}`]);
    tree.buildPaths(tree.rootNode, [], servicesHelpers[`${question.serviceType}`].content);
    console.info('Number of permutations:', tree.paths.length);
    tree.buildScript(question);
  }
});
