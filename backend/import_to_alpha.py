import json
import boto3
from boto3.dynamodb.types import TypeDeserializer

# Load exported questions
with open('questions-export.json', 'r') as f:
    data = json.load(f)

# Initialize DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='eu-west-2')
table = dynamodb.Table('ServiceStack-InterviewQuestions3AFA3AF5-119O4YNIJEZFK')

# Deserialize DynamoDB format
deserializer = TypeDeserializer()
items = []
for item in data['Items']:
    deserialized = {k: deserializer.deserialize(v) for k, v in item.items()}
    items.append(deserialized)

print(f"Importing {len(items)} questions...")

# Import items
with table.batch_writer() as batch:
    for item in items:
        batch.put_item(Item=item)

print("Import complete!")
