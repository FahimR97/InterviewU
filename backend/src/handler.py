import json
import boto3
import os
from boto3.dynamodb.types import TypeDeserializer

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])
deserializer = TypeDeserializer()

def convert_dynamodb_item(item):
    """Convert DynamoDB item to regular Python dict"""
    if isinstance(item, dict):
        return {k: convert_dynamodb_item(v) for k, v in item.items()}
    elif isinstance(item, set):
        return list(item)  # Convert sets to lists
    else:
        return item

def handler(event, context):
    path = event['path']
    
    try:
        if path == '/questions':
            response = table.scan()
            items = [convert_dynamodb_item(item) for item in response['Items']]
            return {
                "statusCode": 200,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps(items)
            }
        elif path.startswith('/questions/'):
            question_id = path.split('/')[-1]
            response = table.get_item(Key={'id': question_id})
            
            if 'Item' in response:
                item = convert_dynamodb_item(response['Item'])
                return {
                    "statusCode": 200,
                    "headers": {"Access-Control-Allow-Origin": "*"},
                    "body": json.dumps(item)
                }
            return {
                "statusCode": 404,
                "headers": {"Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Not found"})
            }
        else:
            return {
                "statusCode": 200,
                "body": json.dumps({"message": "Hello from Lambda!"})
            }
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": str(e)})
        }

