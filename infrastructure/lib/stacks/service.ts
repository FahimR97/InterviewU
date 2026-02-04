import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudtrail from 'aws-cdk-lib/aws-cloudtrail';

export interface ServiceStackProps extends cdk.StackProps {
  enableMonitoring?: boolean;
  notificationEmail?: string;
}

export class ServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: ServiceStackProps) {
    super(scope, id, props);
    
    const enableMonitoring = props?.enableMonitoring ?? true;

    const userPool = new cognito.UserPool(this, 'InterviewQuestionBankUserPool', {
      userPoolName: 'interview-question-bank-users',
      selfSignUpEnabled: false,
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = userPool.addClient('WebAppClient', {
      userPoolClientName: 'web-app-client',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      preventUserExistenceErrors: true,
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
    });

    const frontendS3 = new s3.Bucket(this, 'FrontendBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: 'OAI for Interview Question Bank Frontend',
    });

    frontendS3.grantRead(originAccessIdentity);

    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(frontendS3, {
          originAccessIdentity: originAccessIdentity,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: frontendS3.bucketName,
    });

    new cdk.CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

    new cdk.CfnOutput(this, 'CloudFrontDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront Domain Name',
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
    
    // Lambda function for handling interview questions 
    const questionsHandler = new lambda.Function(this, 'QuestionsHandler', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'questions_handler.handler',
      code: lambda.Code.fromAsset("../backend/src"),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        TABLE_NAME: table.tableName,
        LOG_LEVEL: 'INFO',
      },
    });

    // Grant the Lambda function read/write permissions to the table
    table.grantReadWriteData(questionsHandler);

    // Lambda for Marcus evaluation (direct model invocation)
    const evaluateAnswerFn = new lambda.Function(this, 'EvaluateAnswerFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'evaluate_answer.handler',
      code: lambda.Code.fromAsset("../backend/src"),
      timeout: cdk.Duration.seconds(30),
    });

    // Grant Bedrock model invocation permission
    evaluateAnswerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:eu-west-2::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0'],
    }));

    const lambdaIntegration = new apigw.LambdaIntegration(questionsHandler);
    const evaluateIntegration = new apigw.LambdaIntegration(evaluateAnswerFn);

    const cognitoAuthorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'CognitoAuthorizer',
      identitySource: 'method.request.header.Authorization',
    });

    // Public HTTP endpoint using API Gateway
    const api = new apigw.LambdaRestApi(this, 'TestApi', {
      handler: questionsHandler,
      proxy: false,
      description: 'Interview Question Bank API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });

    const test = api.root.addResource('testing');
    test.addMethod('GET', lambdaIntegration);

    const questions = api.root.addResource('questions');

    questions.addMethod('GET', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    questions.addMethod('POST', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    const questionById = questions.addResource('{id}');
    questionById.addMethod('GET', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    questionById.addMethod('PUT', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    questionById.addMethod('DELETE', lambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    // Marcus evaluation endpoint
    const answers = api.root.addResource('answers');
    answers.addMethod('POST', evaluateIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    // Output the URL so you can curl it after deploy
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'Invoke this URL to test the deployed Lambda',
    });

    new cdk.CfnOutput(this, 'QuestionsEndpoint', {
      value: `${api.url}questions`,
    });

    // ============================================
    // CloudWatch Monitoring (Optional)
    // ============================================
    if (enableMonitoring) {
      // SNS Topic for alarm notifications (optional)
      let alarmTopic: sns.Topic | undefined;
      if (props?.notificationEmail) {
        alarmTopic = new sns.Topic(this, 'AlarmTopic', {
          displayName: 'Interview Questions API Alarms',
        });

        new sns.Subscription(this, 'AlarmEmailSubscription', {
          topic: alarmTopic,
          protocol: sns.SubscriptionProtocol.EMAIL,
          endpoint: props.notificationEmail,
        });

        new cdk.CfnOutput(this, 'AlarmTopicArn', {
          value: alarmTopic.topicArn,
          description: 'SNS Topic ARN for alarm notifications',
        });
      }

      // Lambda Error Alarm
      const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
        alarmName: `${this.stackName}-lambda-errors`,
        alarmDescription: 'Triggers when Lambda function has errors',
        metric: questionsHandler.metricErrors({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // Lambda Throttle Alarm
      const lambdaThrottleAlarm = new cloudwatch.Alarm(this, 'LambdaThrottleAlarm', {
        alarmName: `${this.stackName}-lambda-throttles`,
        alarmDescription: 'Triggers when Lambda function is throttled',
        metric: questionsHandler.metricThrottles({
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // Lambda Duration Alarm (high latency warning)
      const lambdaDurationAlarm = new cloudwatch.Alarm(this, 'LambdaDurationAlarm', {
        alarmName: `${this.stackName}-lambda-high-duration`,
        alarmDescription: 'Triggers when Lambda duration is consistently high',
        metric: questionsHandler.metricDuration({
          statistic: 'Average',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5000, // 5 seconds
        evaluationPeriods: 2,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // API Gateway 5XX Error Alarm
      const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxErrorAlarm', {
        alarmName: `${this.stackName}-api-5xx-errors`,
        alarmDescription: 'Triggers when API Gateway has 5XX errors',
        metric: new cloudwatch.Metric({
          namespace: 'AWS/ApiGateway',
          metricName: '5XXError',
          dimensionsMap: {
            ApiName: api.restApiName,
          },
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }),
        threshold: 5,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });

      // Add SNS actions if topic is configured
      if (alarmTopic) {
        const snsAction = new cloudwatch_actions.SnsAction(alarmTopic);
        lambdaErrorAlarm.addAlarmAction(snsAction);
        lambdaThrottleAlarm.addAlarmAction(snsAction);
        lambdaDurationAlarm.addAlarmAction(snsAction);
        api5xxAlarm.addAlarmAction(snsAction);
      }

      // CloudWatch Dashboard
      const dashboard = new cloudwatch.Dashboard(this, 'ApiDashboard', {
        dashboardName: `${this.stackName}-monitoring`,
      });

      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Lambda Invocations',
          left: [questionsHandler.metricInvocations()],
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: 'Lambda Errors',
          left: [questionsHandler.metricErrors()],
          width: 12,
        })
      );

      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Lambda Duration',
          left: [
            questionsHandler.metricDuration({ statistic: 'Average' }),
            questionsHandler.metricDuration({ statistic: 'p99' }),
          ],
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: 'Lambda Throttles',
          left: [questionsHandler.metricThrottles()],
          width: 12,
        })
      );

      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'API Gateway Requests',
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/ApiGateway',
              metricName: 'Count',
              dimensionsMap: { ApiName: api.restApiName },
              statistic: 'Sum',
            }),
          ],
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: 'API Gateway Latency',
          left: [
            new cloudwatch.Metric({
              namespace: 'AWS/ApiGateway',
              metricName: 'Latency',
              dimensionsMap: { ApiName: api.restApiName },
              statistic: 'Average',
            }),
          ],
          width: 12,
        })
      );

      new cdk.CfnOutput(this, 'DashboardUrl', {
        value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
        description: 'CloudWatch Dashboard URL',
      });
    }

    // CloudTrail for audit logging and API activity monitoring
    // Demonstrates K11 (monitoring technologies) and S6 (install/manage monitoring tools)

    // S3 bucket for CloudTrail logs
    const trailBucket = new s3.Bucket(this, 'CloudTrailBucket', {
      bucketName: `cloudtrail-logs-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'DeleteOldLogs',
          enabled: true,
          expiration: cdk.Duration.days(90), // Keep logs for 90 days
        },
        {
          id: 'TransitionToIA',
          enabled: true,
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30), // Move to IA after 30 days
            },
          ],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Keep logs even if stack is deleted
    });

    // CloudWatch Log Group for CloudTrail
    const trailLogGroup = new logs.LogGroup(this, 'CloudTrailLogGroup', {
      logGroupName: `/aws/cloudtrail/${this.stackName}`,
      retention: logs.RetentionDays.ONE_MONTH, // Cost optimization
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // CloudTrail Trail
    const trail = new cloudtrail.Trail(this, 'ApiActivityTrail', {
      trailName: 'ApiActivityTrail',
      bucket: trailBucket,
      cloudWatchLogGroup: trailLogGroup,
      enableFileValidation: true, // Ensure log integrity
      includeGlobalServiceEvents: true, // Include IAM, CloudFront, etc.
      isMultiRegionTrail: false, // Single region (eu-west-1) to save costs
      managementEvents: cloudtrail.ReadWriteType.ALL, // Track all API calls
      sendToCloudWatchLogs: true,
    });

    // Outputs
    new cdk.CfnOutput(this, 'CloudTrailBucketName', {
      value: trailBucket.bucketName,
      description: 'S3 bucket storing CloudTrail logs',
    });

    new cdk.CfnOutput(this, 'CloudTrailLogGroupName', {
      value: trailLogGroup.logGroupName,
      description: 'CloudWatch Log Group for CloudTrail events',
    });
  }
}
