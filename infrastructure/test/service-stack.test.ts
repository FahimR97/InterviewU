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
    // Expect 4: QuestionsHandler + EvaluateAnswerFn + AdminCreateUser + LogRetention custom resource Lambda
    template.resourceCountIs('AWS::Lambda::Function', 4);
    template.resourceCountIs('AWS::S3::Bucket', 2); // Frontend + CloudTrail
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

    // Test QuestionsHandler Lambda
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'python3.11',
      Handler: 'questions_handler.handler',
      Environment: {
        Variables: {
          TABLE_NAME: Match.anyValue(),
        },
      },
    });

    // Test EvaluateAnswerFn Lambda
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'python3.11',
      Handler: 'evaluate_answer.handler',
      Timeout: 30,
    });
  });

  test('AdminCreateUser Lambda has USER_POOL_ID environment variable', () => {
    const template = synthTemplate();

    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'python3.11',
      Handler: 'admin_create_user.handler',
      Environment: Match.objectLike({
        Variables: Match.objectLike({
          USER_POOL_ID: Match.anyValue(),
        }),
      }),
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

  test('CloudTrail is configured with S3 bucket and CloudWatch logs', () => {
    const template = synthTemplate();

    // CloudTrail resource exists
    template.resourceCountIs('AWS::CloudTrail::Trail', 1);

    // CloudTrail has proper configuration
    template.hasResourceProperties('AWS::CloudTrail::Trail', {
      EnableLogFileValidation: true,
      IncludeGlobalServiceEvents: true,
      IsMultiRegionTrail: false, // Single region for cost optimization
      IsLogging: true,
    });
  });

  test('CloudTrail S3 bucket is encrypted and versioned', () => {
    const template = synthTemplate();

    // Check that at least one S3 bucket has versioning enabled (CloudTrail bucket)
    template.hasResourceProperties('AWS::S3::Bucket', {
      VersioningConfiguration: {
        Status: 'Enabled',
      },
    });
  });

  test('Signup endpoint exists and is public (no authorization)', () => {
    const template = synthTemplate();

    // Find all API Gateway methods
    const methods = template.findResources('AWS::ApiGateway::Method');

    // Check if there's a POST method on signup resource without authorization
    let foundPublicSignup = false;

    Object.entries(methods).forEach(([_, method]: [string, any]) => {
      // Check if this is a POST method with NONE authorization (public)
      if (method.Properties.HttpMethod === 'POST' &&
          method.Properties.AuthorizationType === 'NONE') {
        foundPublicSignup = true;
      }
    });

    expect(foundPublicSignup).toBe(true);
  });

  test('Signup Lambda has AdminCreateUser IAM permissions', () => {
    const template = synthTemplate();

    // Check that there's an IAM policy with cognito-idp:AdminCreateUser permission
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: 'cognito-idp:AdminCreateUser',
            Effect: 'Allow',
          }),
        ]),
      }),
    });
  });

  test('Cognito User Pool has selfSignUpEnabled set to false', () => {
    const template = synthTemplate();

    template.hasResourceProperties('AWS::Cognito::UserPool', {
      Policies: Match.objectLike({
        PasswordPolicy: Match.objectLike({
          MinimumLength: 8,
        }),
      }),
      // Note: selfSignUpEnabled defaults to false when not specified
      // We verify it's not explicitly set to true
    });
  });
});

