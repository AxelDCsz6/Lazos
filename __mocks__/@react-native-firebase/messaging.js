const messaging = () => ({
  requestPermission: jest.fn().mockResolvedValue(1),
  registerDeviceForRemoteMessages: jest.fn().mockResolvedValue(undefined),
  getToken: jest.fn().mockResolvedValue('mock-fcm-token'),
  onMessage: jest.fn().mockReturnValue(() => {}),
  onTokenRefresh: jest.fn().mockReturnValue(() => {}),
  setBackgroundMessageHandler: jest.fn(),
});

messaging.AuthorizationStatus = {
  AUTHORIZED: 1,
  PROVISIONAL: 2,
  NOT_DETERMINED: -1,
  DENIED: 0,
};

module.exports = messaging;
module.exports.default = messaging;
