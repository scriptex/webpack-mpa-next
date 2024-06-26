const { exec } = require('child_process');
const { parse } = require('url');
const { resolve } = require('path');
const { readdirSync } = require('fs');

const { ProvidePlugin } = require('webpack');
const SpritesmithPlugin = require('webpack-spritesmith');
const BrowserSyncPlugin = require('browser-sync-webpack-plugin');
const WebpackShellPlugin = require('webpack-shell-plugin-next');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

const babelConfig = [
	{
		loader: 'babel-loader',
		options: {
			cacheDirectory: true,
			comments: false,
			presets: ['@babel/env']
		}
	}
];

const browserSyncConfig = server => ({
	host: 'localhost',
	port: 3000,
	open: 'external',
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
});

const extractTextConfig = {
	filename: 'app.css'
};

const spritesmithConfig = {
	src: {
		cwd: resolve(__dirname, 'assets/images/sprite'),
		glob: '*.png'
	},
	target: {
		image: resolve(__dirname, './assets/dist/sprite.png'),
		css: resolve(__dirname, './assets/styles/_sprite.css')
	},
	apiOptions: {
		cssImageRef: '../dist/sprite.png'
	},
	retina: '@2x'
};

const cleanConfig = {
	cleanOnceBeforeBuildPatterns: ['**/*', '!sprite.svg']
};

const shellScripts = [];
const svgs = readdirSync('./assets/images/svg').filter(svg => svg[0] !== '.');

if (svgs.length) {
	shellScripts.push('svg-symbol-sprite -i assets/images/svg -o assets/dist/sprite.svg -p svg-');
}

module.exports = (env, argv) => {
	const { url, server } = env;
	const { mode } = argv;

	const isDevelopment = mode === 'development';
	const isProduction = mode === 'production';

	if (server) {
		exec('php index.php > index.html');
	}

	const sourceMap = {
		sourceMap: isDevelopment
	};

	const postcssOptions = {
		ident: 'postcss',
		plugins: [
			require('autoprefixer'),
			require('postcss-mixins'),
			require('postcss-easy-import'),
			require('postcss-url')({
				url: 'rebase'
			}),
			require('postcss-normalize')({
				forceImport: true
			}),
			require('postcss-color-mod-function'),
			require('postcss-each-variables'),
			require('postcss-each'),
			require('postcss-for'),
			require('postcss-nested'),
			require('postcss-extend'),
			require('postcss-utilities'),
			require('postcss-flexbugs-fixes'),
			require('postcss-merge-rules'),
			require('postcss-calc'),
			require('postcss-custom-media')
		],
		...sourceMap
	};

	if (isProduction) {
		postcssOptions.plugins.push(require('postcss-merge-rules'), require('cssnano')());
	}

	if (isDevelopment) {
		postcssOptions.plugins.push(
			require('postcss-watch-folder')({
				folder: './assets/styles',
				main: './assets/styles/main.css'
			})
		);
	}

	const config = {
		mode,
		entry: ['./assets/styles/main.css', './assets/scripts/main.js'],
		output: {
			path: resolve(__dirname, './assets/dist'),
			filename: 'app.js'
		},
		resolve: {
			modules: ['node_modules', './assets/scripts', './assets/images/sprite']
		},
		module: {
			rules: [
				{
					test: /\.(sa|sc|c)ss$/,
					use: [
						{
							loader: MiniCssExtractPlugin.loader
						},
						{
							loader: 'css-loader',
							options: sourceMap
						},
						{
							loader: 'postcss-loader',
							options: { postcssOptions }
						}
					]
				},
				{
					test: /\.js$/,
					exclude: /node_modules/,
					use: babelConfig
				},
				{
					test: /\.(jpe?g|gif|png|svg|woff2?|ttf|eot|wav|mp3|mp4)(\?.*$|$)/,
					type: 'asset/resource'
				}
			]
		},
		plugins: [
			new ProvidePlugin({
				$: 'jquery',
				jQuery: 'jquery',
				'window.jQuery': 'jquery'
			}),
			new MiniCssExtractPlugin(extractTextConfig),
			new SpritesmithPlugin(spritesmithConfig),
			new CleanWebpackPlugin(cleanConfig),
			new WebpackShellPlugin({
				onBuildStart: {
					scripts: shellScripts
				}
			})
		],
		externals: {
			jquery: 'jQuery'
		},
		cache: true,
		bail: false,
		devtool: isDevelopment ? 'source-map' : false,
		stats: 'errors-only'
	};

	const bsConfig = browserSyncConfig(server);

	if (isDevelopment) {
		if (url) {
			bsConfig.host = parse(url).hostname;
			bsConfig.proxy = url;
		}

		if (server) {
			delete bsConfig.host;
			delete bsConfig.proxy;

			bsConfig.server = true;
		}

		config.plugins.push(
			new BrowserSyncPlugin(bsConfig, {
				reload: false
			})
		);
	}

	return config;
};
