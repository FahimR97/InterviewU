import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';


export class ServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    const frontendS3 = new s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendS3.bucketName,
    });

    // Dynamo DB Table
      const table = new dynamodb.Table(this, 'InterviewQuestions', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
    });

      new cdk.CfnOutput(this, 'EPAproject', {
      value: table.tableName,
      description: 'DynamoDB table name',
    });
    
    // Simple Lambda function
    const helloFn = new lambda.Function(this, 'HelloFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset("../backend")
    });

    // Grant the Lambda function read/write permissions to the table
    table.grantReadWriteData(helloFn);

    // Public HTTP endpoint using API Gateway
    const api = new apigw.LambdaRestApi(this, 'TestApi', {
      handler: helloFn,
      proxy: false,
      description: 'Simple test API to verify CDK deployments',
    });

    const test = api.root.addResource('testing')
    test.addMethod('GET')

    // Output the URL so you can curl it after deploy
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'Invoke this URL to test the deployed Lambda',
    });
  }
}
