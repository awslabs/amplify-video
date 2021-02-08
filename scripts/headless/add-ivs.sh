#!/bin/bash
set -e
IFS='|'

STD_LOW="{\
\"service\":\"video\",\
\"serviceType\":\"ivs\",\
\"providerName\":\"awscloudformation\",\
\"resourceName\":\"stdLow\",\
\"channelQuality\":\"STANDARD\",\
\"channelLatency\":\"LOW\"\
}"

STD_NORMAL="{\
\"service\":\"video\",\
\"serviceType\":\"ivs\",\
\"providerName\":\"awscloudformation\",\
\"resourceName\":\"stdNormal\",\
\"channelQuality\":\"STANDARD\",\
\"channelLatency\":\"NORMAL\"\
}"

BASIC_LOW="{\
\"service\":\"video\",\
\"serviceType\":\"ivs\",\
\"providerName\":\"awscloudformation\",\
\"resourceName\":\"basicLow\",\
\"channelQuality\":\"BASIC\",\
\"channelLatency\":\"LOW\"\
}"

BASIC_NORMAL="{\
\"service\":\"video\",\
\"serviceType\":\"ivs\",\
\"providerName\":\"awscloudformation\",\
\"resourceName\":\"basicNormal\",\
\"channelQuality\":\"BASIC\",\
\"channelLatency\":\"NORMAL\"\
}"

amplify video add --payload $STD_LOW
amplify video add --payload $STD_NORMAL
amplify video add --payload $BASIC_LOW
amplify video add --payload $BASIC_NORMAL