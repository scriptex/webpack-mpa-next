// @ts-nocheck
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { argv } = require('yargs');
const { parse } = require('url');

const { ProvidePlugin } = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const SpritesmithPlugin = require('webpack-spritesmith');
const BrowserSyncPlugin = require('browser-sync-webpack-plugin');
const WebpackShellPlugin = require('webpack-shell-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const { url, server, NODE_ENV } = argv;
const sourceMap = {
	sourceMap: NODE_ENV === 'development'
};

if (server) {
	exec('php index.php > index.html');
}

const svgoConfig = {
	plugins: [
		{ cleanupAttrs: true },
		{ removeDoctype: true },
		{ removeXMLProcInst: true },
		{ removeComments: true },
		{ removeMetadata: true },
		{ removeUselessDefs: true },
		{ removeEditorsNSData: true },
		{ removeEmptyAttrs: true },
		{ removeHiddenElems: false },
		{ removeEmptyText: true },
		{ removeEmptyContainers: true },
		{ cleanupEnableBackground: true },
		{ removeViewBox: false },
		{ cleanupIDs: false },
		{ convertStyleToAttrs: true },
		{ removeUselessStrokeAndFill: true }
	]
};

const postcssConfig = {
	ident: 'postcss',
	plugins: [
		require('postcss-easy-import'),
		require('postcss-url')({
			url: 'rebase'
		}),
		require('postcss-preset-env')({
			stage: 0
		}),
		require('postcss-nested'),
		require('postcss-mixins'),
		require('postcss-utilities'),
		require('postcss-flexbugs-fixes')
	],
	...sourceMap
};

const babelConfig = [
	{
		loader: 'babel-loader',
		options: {
			cacheDirectory: true,
			comments: false,
			presets: ['@babel/env'],
			plugins: [
				// Stage 2
				['@babel/plugin-proposal-decorators', { legacy: true }],
				'@babel/plugin-proposal-function-sent',
				'@babel/plugin-proposal-export-namespace-from',
				'@babel/plugin-proposal-numeric-separator',
				'@babel/plugin-proposal-throw-expressions',
				// Stage 3
				'@babel/plugin-syntax-dynamic-import',
				'@babel/plugin-syntax-import-meta',
				['@babel/plugin-proposal-class-properties', { loose: false }],
				'@babel/plugin-proposal-json-strings'
			]
		}
	}
];

const browserSyncConfig = {
	host: 'localhost',
	port: 3000,
	open: 'external',
	/* eslint-disable no-mixed-spaces-and-tabs */
	files: [
		server
			? {
					match: ['*.php'],
					fn(_, file) {
						const name = file.replace(/.php$/, '');

						exec(`php ${file} > ${name}.html`);
					}
			  }
			: '**/*.php',
		'**/*.html',
		'./assets/dist/app.css',
		'./assets/dist/app.js'
	],
	/* eslint-enable */
	ghostMode: {
		clicks: false,
		scroll: true,
		forms: {
			submit: true,
			inputs: true,
			toggles: true
		}
	},
	snippetOptions: {
		rule: {
			match: /<\/body>/i,
			fn: (snippet, match) => `${snippet}${match}`
		}
	},
	proxy: 'localhost'
};

const extractTextConfig = {
	filename: 'dist/app.css',
	allChunks: true
};

const spritesmithConfig = {
	src: {
		cwd: path.resolve(__dirname, 'assets/images/sprite'),
		glob: '*.png'
	},
	target: {
		image: path.resolve(__dirname, './assets/dist/sprite.png'),
		css: path.resolve(__dirname, './assets/styles/_sprite.css')
	},
	apiOptions: {
		cssImageRef: '../dist/sprite.png'
	},
	retina: '@2x'
};

const cleanConfig = {
	cleanOnceBeforeBuildPatterns: ['dist/*', '!dist/sprite.svg']
};

const shellScripts = [];
const svgs = fs.readdirSync('./assets/images/svg').filter(svg => svg[0] !== '.');

if (svgs.length) {
	shellScripts.push('svgo -f assets/images/svg --config=' + JSON.stringify(svgoConfig));
	shellScripts.push('spritesh -q -i assets/images/svg -o ./assets/dist/sprite.svg -p svg-');
}

module.exports = () => {
	const isDevelopment = NODE_ENV === 'development';
	const isProduction = NODE_ENV === 'production';

	if (isProduction) {
		postcssConfig.plugins.push(
			require('postcss-merge-rules'),
			require('cssnano')({
				discardComments: {
					removeAll: true
				}
			})
		);
	}

	if (isDevelopment) {
		postcssConfig.plugins.push(
			require('postcss-watch-folder')({
				folder: './assets/styles',
				main: './assets/styles/main.css'
			})
		);
	}

	const config = {
		mode: NODE_ENV,
		entry: ['./assets/styles/main.css', './assets/scripts/main.js'],
		output: {
			path: path.resolve(__dirname, './assets'),
			filename: 'dist/app.js'
		},
		resolve: {
			modules: ['node_modules', './assets/scripts', './assets/images/sprite']
		},
		module: {
			rules: [
				{
					test: /\.css$/,
					use: ExtractTextPlugin.extract({
						use: [
							{
								loader: 'css-loader',
								options: sourceMap
							},
							{
								loader: 'postcss-loader',
								options: postcssConfig
							}
						]
					})
				},
				{
					test: /\.js$/,
					exclude: /node_modules/,
					use: babelConfig
				},
				{
					test: /\.(jpe?g|gif|png|svg|woff2?|ttf|eot|wav|mp3|mp4)(\?.*$|$)/,
					use: [
						{
							loader: 'file-loader',
							options: {
								name: '[hash].[ext]',
								context: '',
								publicPath: './',
								outputPath: './dist'
							}
						}
					]
				}
			]
		},
		plugins: [
			new ProvidePlugin({
				$: 'jquery',
				jQuery: 'jquery',
				'window.jQuery': 'jquery'
			}),
			new ExtractTextPlugin(extractTextConfig),
			new SpritesmithPlugin(spritesmithConfig),
			new CleanWebpackPlugin(cleanConfig),
			new WebpackShellPlugin({
				onBuildStart: shellScripts
			})
		],
		cache: true,
		bail: false,
		devtool: isDevelopment ? 'source-map' : false,
		stats: 'errors-only'
	};

	if (isDevelopment) {
		if (url) {
			browserSyncConfig.host = parse(url).hostname;
			browserSyncConfig.proxy = url;
		}

		if (server) {
			delete browserSyncConfig.host;
			delete browserSyncConfig.proxy;

			browserSyncConfig.server = true;
		}

		config.plugins.push(
			new BrowserSyncPlugin(browserSyncConfig, {
				reload: false
			})
		);
	}

	return config;
};
