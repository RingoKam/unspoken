const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const copyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
	mode: 'development',
	entry: {
		index: './index.js',
	},
	module: {
		rules: [
			{
				test: /\.css$/i,
				use: ['style-loader', 'css-loader'],
			},
		],
	},
	devServer: {
		static: [{
			directory: path.join(__dirname, 'dist'),
		}, {
			directory: path.join(__dirname, 'assets'),
		}],
		host: '0.0.0.0',
		server: 'https',
		compress: true,
		port: 8081,
	},
	output: {
		filename: '[name].bundle.js',
		path: path.resolve(__dirname, '..','docs'),
		clean: true,
	},
	plugins: [
		new HtmlWebpackPlugin({
			template: './index.html',
		}),
		new copyWebpackPlugin({
			patterns: [
				{
					from: 'assets',
					to: 'assets',
				},
			],
		})
	],
	devtool: 'source-map',
};
