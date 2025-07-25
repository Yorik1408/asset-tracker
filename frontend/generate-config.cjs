const fs = require('fs');
const { join } = require('path');

const tailwindConfig = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

const postcssConfig = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {}
  }
};

fs.writeFileSync(join(__dirname, 'tailwind.config.js'), `module.exports = ${JSON.stringify(tailwindConfig, null, 2)};`);
fs.writeFileSync(join(__dirname, 'postcss.config.js'), `module.exports = ${JSON.stringify(postcssConfig, null, 2)};`);

console.log("✅ Конфиги созданы:");
console.log("- tailwind.config.js");
console.log("- postcss.config.js");