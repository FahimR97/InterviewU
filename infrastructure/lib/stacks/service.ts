import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';


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


    // Simple Lambda function
    const helloFn = new lambda.Function(this, 'HelloFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset("../backend")
    });

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
