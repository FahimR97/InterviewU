export const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'eu-west-2_amQvo3MsF',
      userPoolClientId: '12b9feb5ffl7f9pokih2lq89pq',
      loginWith: {
        email: true,
      },
    },
  },
  API: {
    REST: {
      InterviewQuestionsAPI: {
        endpoint: 'https://16xcub4grb.execute-api.eu-west-2.amazonaws.com/prod/',
        region: 'eu-west-2',
      },
    },
  },
};
