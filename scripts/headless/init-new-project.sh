#!/bin/bash
set -e
IFS='|'

CONFIG="{\
\"SourceDir\":\"src\",\
\"DistributionDir\":\"dist\",\
\"BuildCommand\":\"npm run-script build\",\
\"StartCommand\":\"npm run-script start\"\
}"

AWSCLOUDFORMATIONCONFIG="{\
\"configLevel\":\"project\",\
\"useProfile\":true,\
\"profileName\":\"default\"\
}"

AMPLIFY="{\
\"projectName\":\"amplifyVideoProject\",\
\"envName\":\"dev\",\
\"defaultEditor\":\"code\"\
}"

FRONTEND="{\
\"frontend\":\"javascript\",\
\"framework\":\"none\",\
\"config\":$CONFIG\
}"

PROVIDERS="{\
\"awscloudformation\":$AWSCLOUDFORMATIONCONFIG\
}"

amplify init \
--amplify $AMPLIFY \
--frontend $FRONTEND \
--providers $PROVIDERS \
--yes