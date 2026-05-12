const React = require('react');
const { View, ScrollView, FlatList, TouchableOpacity } = require('react-native');

const GestureHandlerRootView = ({ children, ...props }) =>
  React.createElement(View, props, children);

const Swipeable = ({ children }) => React.createElement(View, null, children);

module.exports = {
  GestureHandlerRootView,
  Swipeable,
  FlatList,
  ScrollView,
  TouchableOpacity,
  State: {},
  Directions: {},
  gestureHandlerRootHOC: c => c,
  PanGestureHandler: ({ children }) => React.createElement(View, null, children),
  TapGestureHandler: ({ children }) => React.createElement(View, null, children),
};
