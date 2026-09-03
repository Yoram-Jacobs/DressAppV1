// craco.config.js
const path = require("path");
const { getLoaders, loaderByName } = require("@craco/craco");
require("dotenv").config();

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

let webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'lucide-react': path.resolve(__dirname, 'node_modules/lucide-react/dist/cjs/lucide-react.js'),
      'recharts': path.resolve(__dirname, 'node_modules/recharts/lib/index.js'),
      'motion-utils': require.resolve('motion-utils'),
      // Override the package stub so the full Sonner toast fires on web
      './aiNotice.js': path.resolve(__dirname, 'src/lib/aiNotice.jsx'),
    },
    configure: (webpackConfig) => {

      // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
        ],
      };

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }

      // Fix for Webpack 5 / Babel ESM resolution issues (e.g. Can't resolve helpers/esm/objectSpread2.js)
      webpackConfig.module.rules.push({
        test: /\.m?js/,
        resolve: {
          fullySpecified: false,
        },
      });

      // Ensure postcss-loader uses local tailwindcss v3, not root v4
      try {
        const { matches } = getLoaders(webpackConfig, loaderByName('postcss-loader'));
        const localTw = require(path.resolve(__dirname, 'node_modules/tailwindcss'));
        for (const m of matches) {
          if (m?.loader?.options?.postcssOptions?.plugins) {
            const plugins = m.loader.options.postcssOptions.plugins;
            const twIdx = plugins.indexOf('tailwindcss');
            if (twIdx !== -1) {
              plugins[twIdx] = localTw;
            }
          }
        }
      } catch (err) {
        console.warn('Could not override tailwindcss in postcss-loader:', err);
      }

      return webpackConfig;
    },
  },
};

webpackConfig.devServer = (devServerConfig) => {
  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};


module.exports = webpackConfig;
