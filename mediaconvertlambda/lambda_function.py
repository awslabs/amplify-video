import logging
import subprocess
import os
import boto3

SIGNED_URL_EXPIRATION = 300     # The number of seconds that the Signed URL is valid
DYNAMODB_TABLE_NAME = os.environ['DYNAMODB_TABLE_NAME']
DYNAMO = boto3.resource("dynamodb")
region= os.environ['region']
mc_client = boto3.client('mediaconvert', region_name=region)
endpoints = mc_client.describe_endpoints()
MEDIACONVERT= boto3.client('mediaconvert', region_name=region, endpoint_url=endpoints['Endpoints'][0]['Url'], verify=False)
TABLE = DYNAMO.Table(DYNAMODB_TABLE_NAME)

logger = logging.getLogger('boto3')
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    for s3_record in event['Records']:
        logger.info("Working on new s3_record...")
        # Extract the Key and Bucket names for the asset uploaded to S3
        key = s3_record['s3']['object']['key']
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
        xml_output = subprocess.check_output(["./mediainfo", "--full", "--output=XML", signed_url])
        #logger.info("Output: {}".format(xml_output))
        #save_record(key, xml_output)
        s3key = "s3://"+bucket+'/'+key
        logger.info(s3key)
        launch_transcode(s3key)

def launch_transcode(s3key):
    logger.info("Kicking off Transcode Job!")
    queue = MEDIACONVERT.list_queues()
    logger.info("HELLOOOOOOO")
    logger.info(queue)
    response = MEDIACONVERT.create_job(
      JobTemplate= "arn:aws:mediaconvert:us-east-1:585391604912:jobTemplates/System-Ott_Hls_Ts_Avc_Aac",
      Queue= "arn:aws:mediaconvert:us-east-1:585391604912:queues/Default",
      UserMetadata= {},
      Role= os.environ["mediaconvertrole"],
      Settings= {
        "OutputGroups": [
          {
            "Name": "Apple HLS",
            "Outputs": [
              {
                "Preset": "System-Ott_Hls_Ts_Avc_Aac_16x9_480x270p_15Hz_0.4Mbps",
                "NameModifier": "_Ott_Hls_Ts_Avc_Aac_16x9_480x270p_15Hz_400Kbps"
              },
              {
                "Preset": "System-Ott_Hls_Ts_Avc_Aac_16x9_640x360p_30Hz_0.6Mbps",
                "NameModifier": "_Ott_Hls_Ts_Avc_Aac_16x9_640x360p_30Hz_600Kbps"
              },
              {
                "Preset": "System-Ott_Hls_Ts_Avc_Aac_16x9_640x360p_30Hz_1.2Mbps",
                "NameModifier": "_Ott_Hls_Ts_Avc_Aac_16x9_640x360p_30Hz_1200Kbps"
              },
              {
                "Preset": "System-Ott_Hls_Ts_Avc_Aac_16x9_960x540p_30Hz_3.5Mbps",
                "NameModifier": "_Ott_Hls_Ts_Avc_Aac_16x9_960x540p_30Hz_3500Kbps"
              },
              {
                "Preset": "System-Ott_Hls_Ts_Avc_Aac_16x9_1280x720p_30Hz_3.5Mbps",
                "NameModifier": "_Ott_Hls_Ts_Avc_Aac_16x9_1280x720p_30Hz_3500Kbps"
              },
              {
                "Preset": "System-Ott_Hls_Ts_Avc_Aac_16x9_1280x720p_30Hz_5.0Mbps",
                "NameModifier": "_Ott_Hls_Ts_Avc_Aac_16x9_1280x720p_30Hz_5000Kbps"
              },
              {
                "Preset": "System-Ott_Hls_Ts_Avc_Aac_16x9_1280x720p_30Hz_6.5Mbps",
                "NameModifier": "_Ott_Hls_Ts_Avc_Aac_16x9_1280x720p_30Hz_6500Kbps"
              },
              {
                "Preset": "System-Ott_Hls_Ts_Avc_Aac_16x9_1920x1080p_30Hz_8.5Mbps",
                "NameModifier": "_Ott_Hls_Ts_Avc_Aac_16x9_1920x1080p_30Hz_8500Kbps"
              }
            ],
            "OutputGroupSettings": {
              "Type": "HLS_GROUP_SETTINGS",
              "HlsGroupSettings": {
                "ManifestDurationFormat": "INTEGER",
                "SegmentLength": 3,
                "TimedMetadataId3Period": 10,
                "CaptionLanguageSetting": "OMIT",
                "Destination": "s3://mediainfotest/output/",
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
    
    
    
    
    
    
def save_record(key, xml_output):
    """
    Save record to DynamoDB

    :param key:         S3 Key Name
    :param xml_output:  Technical Metadata in XML Format
    :return:
    """
    logger.info("Saving record to DynamoDB...")
    TABLE.put_item(
       Item={
            'keyName': key,
            'technicalMetadata': xml_output
        }
    )
    logger.info("Saved record to DynamoDB")


def get_signed_url(expires_in, bucket, obj):
    """
    Generate a signed URL
    :param expires_in:  URL Expiration time in seconds
    :param bucket:
    :param obj:         S3 Key name
    :return:            Signed URL
    """
    s3_cli = boto3.client("s3")
    presigned_url = s3_cli.generate_presigned_url('get_object', Params={'Bucket': bucket, 'Key': obj},
                                                  ExpiresIn=expires_in)
    return presigned_url


