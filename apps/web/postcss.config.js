const path = require('path');

const tailwindv3 = require(path.resolve(__dirname, 'node_modules/tailwindcss'));

module.exports = {
  plugins: [
    tailwindv3(path.resolve(__dirname, 'tailwind.config.js')),
    require('autoprefixer'),
  ],
};
