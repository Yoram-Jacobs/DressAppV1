const path = require('path');

module.exports = {
  plugins: [
    require(path.join(__dirname, 'node_modules/tailwindcss'))(path.join(__dirname, 'tailwind.config.js')),
    require('autoprefixer'),
  ],
};
