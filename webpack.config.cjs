const path = require("path");
const webpack = require("webpack");
const nodeExternals = require("webpack-node-externals");

module.exports = {
  mode: "production",
  target: "node",
  entry: "./server/server.js",
  output: {
    path: path.resolve(__dirname, process.env.SERVER_OUT_DIR || "build/server"),
    filename: "server.bundle.cjs",
    clean: true,
  },
  externals: [nodeExternals()],
  externalsPresets: {
    node: true,
  },
  optimization: {
    minimize: false, // Disable minimization for readable output
  },
  resolve: {
    extensions: [".js", ".json"],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              [
                "@babel/preset-env",
                {
                  targets: {
                    node: "14",
                  },
                },
              ],
            ],
          },
        },
      },
    ],
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify("production"),
    }),
  ],
};
