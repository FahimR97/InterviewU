import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as iam from 'aws-cdk-lib/aws-iam';

export interface GitHubOIDCStackProps extends cdk.StackProps {
  githubOrg: string;
  githubRepo: string;
}

export class GitHubOIDCStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GitHubOIDCStackProps) {
    super(scope, id, props);

    // GitHub OIDC Provider
    const provider = new iam.OpenIdConnectProvider(this, 'GitHubOIDCProvider', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
      thumbprints: ['6938fd4d98bab03faadb97b34396831e3780aea1'],
    });

    // IAM Role for GitHub Actions (least-privilege)
    const role = new iam.Role(this, 'GitHubActionsRole', {
      roleName: 'github-actions-deploy',
      assumedBy: new iam.WebIdentityPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
        },
        StringLike: {
          'token.actions.githubusercontent.com:sub': `repo:${props.githubOrg}/${props.githubRepo}:*`,
        },
      }),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCloudFormationFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSLambda_FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonCognitoPowerUser'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonAPIGatewayAdministrator'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudFrontFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchFullAccessV2'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSNSFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXRayFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonRoute53FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCertificateManagerFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCloudTrail_FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMReadOnlyAccess'),
      ],
      maxSessionDuration: cdk.Duration.hours(1),
    });

    // Inline policy for IAM role lifecycle, Budgets, and STS (no user/key creation)
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'iam:CreateRole',
        'iam:DeleteRole',
        'iam:AttachRolePolicy',
        'iam:DetachRolePolicy',
        'iam:PutRolePolicy',
        'iam:DeleteRolePolicy',
        'iam:GetRole',
        'iam:GetRolePolicy',
        'iam:ListRolePolicies',
        'iam:ListAttachedRolePolicies',
        'iam:PassRole',
        'iam:TagRole',
        'iam:UntagRole',
        'iam:UpdateAssumeRolePolicy',
        'iam:CreatePolicy',
        'iam:DeletePolicy',
        'iam:GetPolicy',
        'iam:GetPolicyVersion',
        'iam:ListPolicyVersions',
        'iam:CreatePolicyVersion',
        'iam:DeletePolicyVersion',
        'iam:CreateServiceLinkedRole',
        'budgets:*',
        'sts:AssumeRole',
      ],
      resources: ['*'],
    }));

    new cdk.CfnOutput(this, 'RoleArn', {
      value: role.roleArn,
      description: 'GitHub Actions IAM Role ARN',
    });

    new cdk.CfnOutput(this, 'OIDCProviderArn', {
      value: provider.openIdConnectProviderArn,
      description: 'OIDC Provider ARN',
    });
  }
}
