/**
 * Dependencies for Remote Components
 * NOTE:
 * - We only need the KEYS of this object for webpack externals mapping.
 * - Avoid requiring actual modules here to prevent tight coupling and build-time resolution.
 * - The host app (web) provides these externals at runtime. Plugins now import
 *   'thaliumx-web-lib' directly; no 'hollaex-web-lib' alias is provided.
 */
module.exports = {
  resolve: {
    axios: 'axios',
    classnames: 'classnames',
    mathjs: 'mathjs',
    numbro: 'numbro',
    'prop-types': 'prop-types',
    react: 'react',
    'react-device-detect': 'react-device-detect',
    'react-redux': 'react-redux',
    'react-svg': 'react-svg',
    redux: 'redux',
    'redux-form': 'redux-form',
    validator: 'validator',
    '@ant-design/icons': '@ant-design/icons',
    'react-event-listener': 'react-event-listener',
    'thaliumx-web-lib': 'thaliumx-web-lib',
    antd: 'antd',
    moment: 'moment',
  }
};
