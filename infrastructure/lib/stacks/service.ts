import * as cdk from 'aws-cdk-lib/core';
import * as fs from 'fs';
import * as path from 'path';

// Load .env file if it exists
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
}
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
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as budgets from 'aws-cdk-lib/aws-budgets';

export interface ServiceStackProps extends cdk.StackProps {
  enableMonitoring?: boolean;
  notificationEmail?: string;
  environment?: 'alpha' | 'prod';
}

export class ServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: ServiceStackProps) {
    super(scope, id, props);
    
    const enableMonitoring = props?.enableMonitoring ?? true;
    const environment = props?.environment ?? 'prod';
    const isProduction = environment === 'prod';
    const rootDomain = 'fahimray.people.aws.dev';
    const websiteDomain = isProduction ? rootDomain : `alpha.${rootDomain}`;
    const apiDomain: string | undefined = undefined;
    const hostedZone = isProduction ? route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: 'Z06640972CZPSKCSBKIIZ',
      zoneName: rootDomain,
    }) : undefined;
    const certificate = acm.Certificate.fromCertificateArn(this, 'SiteCert',
      isProduction
        ? 'arn:aws:acm:us-east-1:418107732011:certificate/05a92d5c-7915-47c5-ba09-71affd0dc523'
        : 'arn:aws:acm:us-east-1:134667369518:certificate/b2f39608-866d-44bb-be6d-cf1f5fc38378'
    );
    const apiCertificate: acm.ICertificate | undefined = undefined;

    const userPool = new cognito.UserPool(this, 'InterviewUUserPool', {
      userPoolName: 'InterviewU-users',
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

    // Admin group for privileged users — required for POST/PUT/DELETE on questions
    const adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Admin',
      description: 'Administrators with access to create, update, and delete questions',
      precedence: 1,
    });

    new cdk.CfnOutput(this, 'AdminGroupName', {
      value: adminGroup.groupName || 'Admin',
      description: 'Cognito Admin Group Name',
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
      comment: 'OAI for InterviewU Frontend',
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
      domainNames: [websiteDomain],
      certificate,
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

    // Route53 A Record for CloudFront (production only)
    if (isProduction && hostedZone) {
      new route53.ARecord(this, 'WebsiteAliasRecord', {
        zone: hostedZone,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(distribution)
        ),
      });
    }

    // DynamoDB table for user answer history (analytics)
    const userAnswersTable = new dynamodb.Table(this, 'UserAnswers', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
    });

    new cdk.CfnOutput(this, 'UserAnswersTableName', {
      value: userAnswersTable.tableName,
      description: 'DynamoDB table for user answer history',
    });

    // DynamoDB table for per-user settings (interview date, preferences, etc.)
    const userSettingsTable = new dynamodb.Table(this, 'UserSettings', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true,
    });

    new cdk.CfnOutput(this, 'UserSettingsTableName', {
      value: userSettingsTable.tableName,
      description: 'DynamoDB table for per-user settings',
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
      tracing: lambda.Tracing.ACTIVE,
      logRetention: logs.RetentionDays.ONE_MONTH,
      environment: {
        TABLE_NAME: table.tableName,
        LOG_LEVEL: 'INFO',
      },
    });

    // Grant the Lambda function read/write permissions to the table
    table.grantReadWriteData(questionsHandler);

    // Grant permission to emit custom CloudWatch metrics
    questionsHandler.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: { StringEquals: { 'cloudwatch:namespace': 'InterviewU' } },
    }));

    // Lambda for Marcus evaluation (direct model invocation)
    const evaluateAnswerFn = new lambda.Function(this, 'EvaluateAnswerFunction', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'evaluate_answer.handler',
      code: lambda.Code.fromAsset("../backend/src"),
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        USER_ANSWERS_TABLE_NAME: userAnswersTable.tableName,
      },
    });

    // Grant Bedrock model invocation permission
    evaluateAnswerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: ['arn:aws:bedrock:eu-west-2::foundation-model/anthropic.claude-3-7-sonnet-20250219-v1:0'],
    }));

    // Grant write access to user answers table
    userAnswersTable.grantWriteData(evaluateAnswerFn);

    // Grant permission to emit custom CloudWatch metrics (EvaluationScore, MarcusResponseTime, etc.)
    evaluateAnswerFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
      conditions: { StringEquals: { 'cloudwatch:namespace': 'InterviewU' } },
    }));

    // Lambda for user analytics
    const userAnalyticsHandler = new lambda.Function(this, 'UserAnalyticsHandler', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'analytics_handler.handler',
      code: lambda.Code.fromAsset("../backend/src"),
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        USER_ANSWERS_TABLE_NAME: userAnswersTable.tableName,
      },
    });

    userAnswersTable.grantReadData(userAnalyticsHandler);

    // Lambda for user settings (GET/PUT interview date, preferences)
    const settingsHandler = new lambda.Function(this, 'SettingsHandler', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'settings_handler.handler',
      code: lambda.Code.fromAsset("../backend/src"),
      timeout: cdk.Duration.seconds(15),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        USER_SETTINGS_TABLE_NAME: userSettingsTable.tableName,
      },
    });

    userSettingsTable.grantReadWriteData(settingsHandler);

    // Lambda for user signup (bypasses selfSignUpEnabled restriction)
    const signupHandler = new lambda.Function(this, 'SignupHandler', {
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'admin_create_user.handler',
      code: lambda.Code.fromAsset("../backend/src"),
      timeout: cdk.Duration.seconds(30),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        USER_POOL_ID: userPool.userPoolId,
      },
    });

    // Grant permission to create users
    userPool.grant(signupHandler, 'cognito-idp:AdminCreateUser');

    const lambdaIntegration = new apigw.LambdaIntegration(questionsHandler);
    const evaluateIntegration = new apigw.LambdaIntegration(evaluateAnswerFn);
    const signupIntegration = new apigw.LambdaIntegration(signupHandler);
    const analyticsIntegration = new apigw.LambdaIntegration(userAnalyticsHandler);
    const settingsIntegration = new apigw.LambdaIntegration(settingsHandler);

    const cognitoAuthorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
      cognitoUserPools: [userPool],
      authorizerName: 'CognitoAuthorizer',
      identitySource: 'method.request.header.Authorization',
    });

    // Public HTTP endpoint using API Gateway
    const api = new apigw.LambdaRestApi(this, 'InterviewUApi', {
      handler: questionsHandler,
      proxy: false,
      description: 'InterviewU API',
      deployOptions: {
        tracingEnabled: true,
      },
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

    // Only create the testing endpoint in Alpha environment
    if (environment === 'alpha') {
      const test = api.root.addResource('testing');
      test.addMethod('GET', lambdaIntegration);

      new cdk.CfnOutput(this, 'TestingEndpoint', {
        value: `${api.url}testing`,
        description: 'Testing endpoint (Alpha only)',
      });
    }
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

    // Public signup endpoint (no authentication required)
    const signup = api.root.addResource('signup');
    signup.addMethod('POST', signupIntegration); // No authorizer - public endpoint

    new cdk.CfnOutput(this, 'SignupEndpoint', {
      value: `${api.url}signup`,
    });

    // Analytics endpoint (authenticated)
    const analytics = api.root.addResource('analytics');
    analytics.addMethod('GET', analyticsIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });

    // Settings endpoint (authenticated) — GET/PUT user preferences
    const settings = api.root.addResource('settings');
    settings.addMethod('GET', settingsIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigw.AuthorizationType.COGNITO,
    });
    settings.addMethod('PUT', settingsIntegration, {
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

    // API Gateway Custom Domain (production only)
    if (isProduction && apiDomain && apiCertificate && hostedZone) {
      const customDomain = new apigw.DomainName(this, 'ApiCustomDomain', {
        domainName: apiDomain,
        certificate: apiCertificate,
        endpointType: apigw.EndpointType.REGIONAL,
        securityPolicy: apigw.SecurityPolicy.TLS_1_2,
      });

      customDomain.addBasePathMapping(api, { basePath: '' });

      new route53.ARecord(this, 'ApiAliasRecord', {
        zone: hostedZone,
        recordName: 'api',
        target: route53.RecordTarget.fromAlias(
          new route53Targets.ApiGatewayDomain(customDomain)
        ),
      });

      new cdk.CfnOutput(this, 'ApiCustomDomainName', {
        value: `https://${apiDomain}`,
        description: 'Custom domain URL for the API',
      });
    }

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

      // CloudWatch Dashboard — all Lambdas, API Gateway, DynamoDB
      const allLambdas = [
        { fn: questionsHandler, name: 'Questions' },
        { fn: evaluateAnswerFn, name: 'Evaluate' },
        { fn: userAnalyticsHandler, name: 'Analytics' },
        { fn: settingsHandler, name: 'Settings' },
        { fn: signupHandler, name: 'Signup' },
      ];

      const dashboard = new cloudwatch.Dashboard(this, 'ApiDashboard', {
        dashboardName: `${this.stackName}-monitoring`,
      });

      // Row 1: Lambda invocations & errors (all functions)
      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Lambda Invocations (All)',
          left: allLambdas.map(l => l.fn.metricInvocations({ label: l.name })),
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: 'Lambda Errors (All)',
          left: allLambdas.map(l => l.fn.metricErrors({ label: l.name })),
          width: 12,
        })
      );

      // Row 2: Lambda duration & throttles
      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Lambda Duration Avg (All)',
          left: allLambdas.map(l => l.fn.metricDuration({ statistic: 'Average', label: l.name })),
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: 'Lambda Throttles (All)',
          left: allLambdas.map(l => l.fn.metricThrottles({ label: l.name })),
          width: 12,
        })
      );

      // Row 3: API Gateway
      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'API Requests & Errors',
          left: [
            new cloudwatch.Metric({ namespace: 'AWS/ApiGateway', metricName: 'Count', dimensionsMap: { ApiName: api.restApiName }, statistic: 'Sum', label: 'Requests' }),
          ],
          right: [
            new cloudwatch.Metric({ namespace: 'AWS/ApiGateway', metricName: '4XXError', dimensionsMap: { ApiName: api.restApiName }, statistic: 'Sum', label: '4XX' }),
            new cloudwatch.Metric({ namespace: 'AWS/ApiGateway', metricName: '5XXError', dimensionsMap: { ApiName: api.restApiName }, statistic: 'Sum', label: '5XX' }),
          ],
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: 'API Latency',
          left: [
            new cloudwatch.Metric({ namespace: 'AWS/ApiGateway', metricName: 'Latency', dimensionsMap: { ApiName: api.restApiName }, statistic: 'Average', label: 'Avg' }),
            new cloudwatch.Metric({ namespace: 'AWS/ApiGateway', metricName: 'Latency', dimensionsMap: { ApiName: api.restApiName }, statistic: 'p99', label: 'p99' }),
          ],
          width: 12,
        })
      );

      // Row 4: DynamoDB read/write capacity
      const allTables = [
        { t: table, name: 'Questions' },
        { t: userAnswersTable, name: 'UserAnswers' },
        { t: userSettingsTable, name: 'UserSettings' },
      ];

      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'DynamoDB Read Capacity',
          left: allTables.map(t => new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB', metricName: 'ConsumedReadCapacityUnits',
            dimensionsMap: { TableName: t.t.tableName }, statistic: 'Sum', label: t.name,
          })),
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: 'DynamoDB Write Capacity',
          left: allTables.map(t => new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB', metricName: 'ConsumedWriteCapacityUnits',
            dimensionsMap: { TableName: t.t.tableName }, statistic: 'Sum', label: t.name,
          })),
          width: 12,
        })
      );

      // how the platform is actually used and where improvement opportunities lie.
      // EvaluationScore avg shows whether users are improving over time.
      // EvaluationByCategory reveals which topic areas have the lowest scores.
      // MarcusResponseTime p99 catches Bedrock throttling before users notice.
      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'AI Evaluations & Answer Pass Rate',
          left: [
            new cloudwatch.Metric({ namespace: 'InterviewU', metricName: 'AnswerEvaluated', statistic: 'Sum', label: 'Total Evaluations', period: cdk.Duration.minutes(5) }),
            new cloudwatch.Metric({ namespace: 'InterviewU', metricName: 'AnswerPassRate', statistic: 'Sum', dimensionsMap: { IsCorrect: 'true' }, label: 'Correct Answers', period: cdk.Duration.minutes(5) }),
          ],
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: 'Average Evaluation Score (0–100)',
          left: [
            new cloudwatch.Metric({ namespace: 'InterviewU', metricName: 'EvaluationScore', statistic: 'Average', label: 'Avg Score', period: cdk.Duration.minutes(30) }),
          ],
          width: 12,
        })
      );

      dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: 'Marcus AI Response Time (ms)',
          left: [
            new cloudwatch.Metric({ namespace: 'InterviewU', metricName: 'MarcusResponseTime', statistic: 'Average', label: 'Avg', period: cdk.Duration.minutes(5) }),
            new cloudwatch.Metric({ namespace: 'InterviewU', metricName: 'MarcusResponseTime', statistic: 'p99', label: 'p99', period: cdk.Duration.minutes(5) }),
          ],
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: 'Questions Listed & Viewed',
          left: [
            new cloudwatch.Metric({ namespace: 'InterviewU', metricName: 'QuestionsListed', statistic: 'Sum', label: 'List Requests', period: cdk.Duration.minutes(5) }),
            new cloudwatch.Metric({ namespace: 'InterviewU', metricName: 'QuestionViewed', statistic: 'Sum', label: 'Individual Views', period: cdk.Duration.minutes(5) }),
            new cloudwatch.Metric({ namespace: 'InterviewU', metricName: 'QuestionNotFound', statistic: 'Sum', label: '404s', period: cdk.Duration.minutes(5) }),
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

    // Budget alarm — alert when monthly spend exceeds $100
    if (process.env.BUDGET_ALERT_EMAIL) {
      new budgets.CfnBudget(this, 'MonthlyBudget', {
        budget: {
          budgetName: 'InterviewU-Monthly',
          budgetType: 'COST',
          timeUnit: 'MONTHLY',
          budgetLimit: { amount: 100, unit: 'USD' },
        },
        notificationsWithSubscribers: [{
          notification: {
            notificationType: 'ACTUAL',
            comparisonOperator: 'GREATER_THAN',
            threshold: 80,
            thresholdType: 'PERCENTAGE',
          },
          subscribers: [{ subscriptionType: 'EMAIL', address: process.env.BUDGET_ALERT_EMAIL }],
        }],
      });
    }
  }
}
