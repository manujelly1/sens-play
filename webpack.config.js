const path = require("path");

module.exports = {
  mode: "none",
  target: "web",
  entry: path.resolve(__dirname, "game-src.js"),
  output: {
    filename: "game.js",
    path: __dirname
  },
  optimization: {
    minimize: false
  },
  devtool: false
};
