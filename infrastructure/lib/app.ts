#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import * as stacks from '../lib/stacks/stacks';

const app = new cdk.App();
new stacks.ServiceStack(app, 'ServiceStack', {
  env: { account: '839185960743', region: 'eu-west-1' },
});
