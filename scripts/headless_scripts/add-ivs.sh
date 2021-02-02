#!/bin/bash
set -e
IFS='|'

STD_LOW="{\
\"service\":\"video\",\
\"serviceType\":\"ivs\",\
\"providerName\":\"awscloudformation\",\
\"resourceName\":\"std-low\",\
\"channelQuality\":\"STANDARD\",\
\"channelLatency\":\"LOW\"\
}"

STD_NORMAL="{\
\"service\":\"video\",\
\"serviceType\":\"ivs\",\
\"providerName\":\"awscloudformation\",\
\"resourceName\":\"std-normal\",\
\"channelQuality\":\"STANDARD\",\
\"channelLatency\":\"NORMAL\"\
}"

BASIC_LOW="{\
\"service\":\"video\",\
\"serviceType\":\"ivs\",\
\"providerName\":\"awscloudformation\",\
\"resourceName\":\"basic-low\",\
\"channelQuality\":\"BASIC\",\
\"channelLatency\":\"LOW\"\
}"

BASIC_NORMAL="{\
\"service\":\"video\",\
\"serviceType\":\"ivs\",\
\"providerName\":\"awscloudformation\",\
\"resourceName\":\"basic-normal\",\
\"channelQuality\":\"BASIC\",\
\"channelLatency\":\"NORMAL\"\
}"

amplify video add --payload $STD_LOW
amplify video add --payload $STD_NORMAL
amplify video add --payload $BASIC_LOW
amplify video add --payload $BASIC_NORMAL