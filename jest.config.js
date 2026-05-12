module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-paper|react-native-vector-icons|react-native-screens|react-native-safe-area-context|react-native-keychain|react-native-gesture-handler)/)',
  ],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
    'react-native-gesture-handler': '<rootDir>/__mocks__/react-native-gesture-handler.js',
    '^react-native-image-picker$': '<rootDir>/__mocks__/react-native-image-picker.js',
    '^react-native-image-viewing$': '<rootDir>/__mocks__/react-native-image-viewing.js',
    '^react-native-video$': '<rootDir>/__mocks__/react-native-video.js',
  },
};
