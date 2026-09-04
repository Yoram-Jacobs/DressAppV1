const path = require('path');
const tailwindcss = require(path.resolve(__dirname, 'node_modules/tailwindcss'));
const autoprefixer = require('autoprefixer');

module.exports = {
  plugins: [
    tailwindcss(path.resolve(__dirname, 'tailwind.config.js')),
    autoprefixer,
  ],
};
