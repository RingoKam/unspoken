const amplifyConfig = {
  Auth: {
    // REQUIRED - Amazon Cognito Identity Pool ID
    identityPoolId: 'us-west-2:61e7b9b3-f3d6-4bc0-af27-baf7b531b8c9',
    
    // REQUIRED - Amazon Cognito Region
    region: 'US-WEST-2',
    
    // REQUIRED- Amazon Cognito User Pool ID
    userPoolId: 'us-west-2_o9Iujt5dS',

    userPoolWebClientId: '29tph43qsi3m1s8vove6ri2nrf',

    // OPTIONAL - Enforce user authentication prior to accessing AWS resources or not
    mandatorySignIn: true,
  },
  Api: {
    url: 'https://ntzqrrzq01.execute-api.us-west-2.amazonaws.com/dev/'
  }
};

export default amplifyConfig;