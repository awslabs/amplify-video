import logging
import subprocess
import os
import boto3
from urllib import unquote_plus
from botocore.client import Config
SIGNED_URL_EXPIRATION = 300     # The number of seconds that the Signed URL is valid
mc_client = boto3.client('mediaconvert')
endpoints = mc_client.describe_endpoints()
MEDIACONVERT= boto3.client('mediaconvert', endpoint_url=endpoints['Endpoints'][0]['Url'])

logger = logging.getLogger('boto3')
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    for s3_record in event['Records']:
        logger.info("Working on new s3_record...")
        # Extract the Key and Bucket names for the asset uploaded to S3
        key = unquote_plus(s3_record['s3']['object']['key'])
        bucket = s3_record['s3']['bucket']['name']
        logger.info("Bucket: {} \t Key: {}".format(bucket, key))
        # Generate a signed URL for the uploaded asset
        signed_url = get_signed_url(SIGNED_URL_EXPIRATION, bucket, key)
        logger.info("Signed URL: {}".format(signed_url))
        # Launch MediaInfo
        # Pass the signed URL of the uploaded asset to MediaInfo as an input
        # MediaInfo will extract the technical metadata from the asset
        # The extracted metadata will be outputted in XML format and
        # stored in the variable xml_output
        # xml_output = subprocess.check_output(["./mediainfo", "--full", "--output=XML", signed_url])
        #logger.info("Output: {}".format(xml_output))
        #save_record(key, xml_output)
        s3key = "s3://"+bucket+'/'+key
        logger.info(s3key)
        launch_transcode(s3key)

def launch_transcode(s3key):
    logger.info("Kicking off Transcode Job!")
    res = MEDIACONVERT.list_queues()
    queue = res['Queues'][0]['Arn']
    response = MEDIACONVERT.create_job(
      JobTemplate= os.environ["ARN_TEMPLATE"],
      Queue= queue,
      UserMetadata= {},
      Role= os.environ["MC_ROLE"],
      Settings= {
        "OutputGroups": [
          {
            "Name": "Apple HLS",
            "Outputs": [],
            "OutputGroupSettings": {
              "Type": "HLS_GROUP_SETTINGS",
              "HlsGroupSettings": {
                "ManifestDurationFormat": "INTEGER",
                "SegmentLength": 3,
                "TimedMetadataId3Period": 10,
                "CaptionLanguageSetting": "OMIT",
                "Destination": "s3://" + os.environ["S3_OUTPUT_NAME"] + "/output/",
                "TimedMetadataId3Frame": "PRIV",
                "CodecSpecification": "RFC_4281",
                "OutputSelection": "MANIFESTS_AND_SEGMENTS",
                "ProgramDateTimePeriod": 600,
                "MinSegmentLength": 0,
                "DirectoryStructure": "SINGLE_DIRECTORY",
                "ProgramDateTime": "EXCLUDE",
                "SegmentControl": "SEGMENTED_FILES",
                "ManifestCompression": "NONE",
                "ClientCache": "ENABLED",
                "StreamInfResolution": "INCLUDE"
              }
            }
          }
        ],
        "AdAvailOffset": 0,
        "Inputs": [
          {
            "AudioSelectors": {
              "Audio Selector 1": {
                "Offset": 0,
                "DefaultSelection": "DEFAULT",
                "ProgramSelection": 1
              }
            },
            "VideoSelector": {
              "ColorSpace": "FOLLOW"
            },
            "FilterEnable": "AUTO",
            "PsiControl": "USE_PSI",
            "FilterStrength": 0,
            "DeblockFilter": "DISABLED",
            "DenoiseFilter": "DISABLED",
            "TimecodeSource": "EMBEDDED",
            "FileInput": s3key
          }
        ]
      }
    )
  


def get_signed_url(expires_in, bucket, obj):
    """
    Generate a signed URL
    :param expires_in:  URL Expiration time in seconds
    :param bucket:
    :param obj:         S3 Key name
    :return:            Signed URL
    """
    s3_cli = boto3.client("s3", config=Config(signature_version='s3v4'))
    presigned_url = s3_cli.generate_presigned_url('get_object', Params={'Bucket': bucket, 'Key': obj},
                                                  ExpiresIn=expires_in)
    return presigned_url


