#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import * as stacks from '../lib/stacks/stacks';

const app = new cdk.App();

// Get account and region from environment or CDK context
const account = process.env.CDK_DEFAULT_ACCOUNT || app.node.tryGetContext('account');
const region = process.env.CDK_DEFAULT_REGION || app.node.tryGetContext('region') || 'eu-west-1';

// Optional: Get notification email from context or environment
const notificationEmail = app.node.tryGetContext('notificationEmail') || process.env.ALARM_NOTIFICATION_EMAIL;

const serviceStack = new stacks.ServiceStack(app, 'ServiceStack', {
  env: { account, region },
  enableMonitoring: true,
  notificationEmail: notificationEmail,
});
