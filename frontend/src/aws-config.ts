export const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'eu-west-1_Y2W4Nq5cV',
      userPoolClientId: '631upjij4alek3b8gh76474t9a',
      loginWith: {
        email: true,
      },
    },
  },
  API: {
    REST: {
      InterviewQuestionsAPI: {
        endpoint: 'https://yuc2w2ouqb.execute-api.eu-west-1.amazonaws.com/prod/',
        region: 'eu-west-1',
      },
    },
  },
};
