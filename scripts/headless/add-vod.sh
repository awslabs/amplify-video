#!/bin/bash
set -e
IFS='|'

VOD="{\
\"service\":\"video\",\
\"serviceType\":\"video-on-demand\",\
\"providerName\":\"awscloudformation\",\
\"resourceName\":\"vodTest\",\
\"enableCDN\":true,\
\"signedKey\":true,\
\"enableCMS\":false\
}"

amplify video add --payload $VOD