export const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_CLIENT_ID,
      loginWith: {
        email: true,
      },
    },
  },
  API: {
    REST: {
      InterviewQuestionsAPI: {
        endpoint: import.meta.env.VITE_API_URL,
        region: 'eu-west-2',
      },
    },
  },
};
