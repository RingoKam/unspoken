const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
	mode: 'development',
	entry: {
		auth: './auth.js',
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
		static: {
			directory: path.join(__dirname, 'dist'),
		},
		host: '0.0.0.0',
		server: 'https',
		compress: true,
		port: 8081,
	},
	output: {
		filename: '[name].bundle.js',
		path: path.resolve(__dirname, 'dist'),
		clean: true,
	},
	plugins: [
		// new HtmlWebpackPlugin({
		// 	template: './index.html',
		// }),
		// new ESLintPlugin(),
		new HtmlWebpackPlugin({
			template: './auth.html',
			filename: 'index.html',
			chunks: ['auth']
		}),
		new HtmlWebpackPlugin({
            template: './index.html',
			filename: 'main.html',
			chunks: ['main']
		}),
		// new CopyPlugin({
		// 	patterns: [{ from: 'src/assets', to: 'assets' }],
		// }),
	],
	devtool: 'source-map',
};
