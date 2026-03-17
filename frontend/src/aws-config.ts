export const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'eu-west-2_SueqnW8PB',
      userPoolClientId: '1fqk8jim1mjnk7kakofhq4pugf',
      loginWith: {
        email: true,
      },
    },
  },
  API: {
    REST: {
      InterviewQuestionsAPI: {
        endpoint: 'https://6i75qqzfg9.execute-api.eu-west-2.amazonaws.com/prod/',
        region: 'eu-west-2',
      },
    },
  },
};
