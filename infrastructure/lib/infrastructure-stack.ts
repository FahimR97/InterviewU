import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';


export class InfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Simple Lambda function
    const helloFn = new lambda.Function(this, 'HelloFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async () => {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'CDK deploy works! 🎉' }),
          };
        };
      `),
    });

    // Public HTTP endpoint using API Gateway
    const api = new apigw.LambdaRestApi(this, 'TestApi', {
      handler: helloFn,
      proxy: false,
      description: 'Simple test API to verify CDK deployments',
    });

    api.root.addMethod('test')

    // Output the URL so you can curl it after deploy
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'Invoke this URL to test the deployed Lambda',
    });
  }
}
