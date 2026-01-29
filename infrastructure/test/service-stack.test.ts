import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { ServiceStack } from '../lib/stacks/service';

function synthTemplate() {
  const app = new cdk.App();
  const stack = new ServiceStack(app, 'TestServiceStack');
  return Template.fromStack(stack);
}

describe('ServiceStack CDK tests', () => {
  test('Stack contains core resources', () => {
    const template = synthTemplate();

    template.resourceCountIs('AWS::DynamoDB::Table', 1);
    template.resourceCountIs('AWS::Lambda::Function', 1);
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);
    template.resourceCountIs('AWS::Cognito::UserPool', 1);
    template.resourceCountIs('AWS::ApiGateway::RestApi', 1);
  });

  test('DynamoDB table has correct schema, PAY_PER_REQUEST, PITR, and encryption enabled', () => {
    const template = synthTemplate();

    template.hasResourceProperties('AWS::DynamoDB::Table', {
      AttributeDefinitions: [
        {
          AttributeName: 'id',
          AttributeType: 'S',
        },
      ],
      KeySchema: [
        {
          AttributeName: 'id',
          KeyType: 'HASH',
        },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      PointInTimeRecoverySpecification: {
        PointInTimeRecoveryEnabled: true,
      },
      SSESpecification: {
        SSEEnabled: true,
      },
    });
  });

  test('Lambda function uses Python 3.11 and has TABLE_NAME environment variable', () => {
    const template = synthTemplate();

    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'python3.11',
      Handler: 'src.handler.handler',
      Environment: {
        Variables: {
          TABLE_NAME: Match.anyValue(),
        },
      },
    });
  });

  test('S3 bucket blocks all public access and is encrypted', () => {
    const template = synthTemplate();

    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'AES256',
            },
          },
        ],
      },
    });
  });

  test('CloudFront distribution uses index.html as default root object', () => {
    const template = synthTemplate();

    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: {
        DefaultRootObject: 'index.html',
      },
    });
  });

  test('API Gateway uses a Cognito User Pool authorizer', () => {
    const template = synthTemplate();

    template.hasResourceProperties('AWS::ApiGateway::Authorizer', {
      Type: 'COGNITO_USER_POOLS',
      IdentitySource: 'method.request.header.Authorization',
    });
  });

  test('Protected API methods require Cognito authorization', () => {
    const template = synthTemplate();

    template.hasResourceProperties('AWS::ApiGateway::Method', {
      AuthorizationType: 'COGNITO_USER_POOLS',
    });
  });
});

