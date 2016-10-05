import path from 'path'
import webpack from 'webpack'
import ExtractTextPlugin from 'extract-text-webpack-plugin'
import serverlessPackageJSON from 'serverless/package.json'
import { phenomicLoader } from 'phenomic'
import pkg from './package.json'
import getSiteConfig from './src/_config'

// note that this webpack file is exporting a "makeConfig" function
// which is used for phenomic to build dynamic configuration based on your needs
// see the end of the file if you want to export a default config
// (eg: if you share your config for phenomic and other stuff)
export const makeConfig = (config = {}) => {
  // console.log('site config', config)
  const siteConfig = getSiteConfig(config.production)
  console.log('siteConfig', siteConfig)
  const processVars = Object.keys(siteConfig)
    .reduce((memo, key) => {
      const val = JSON.stringify(siteConfig[key])
      memo[key] = val
      return memo
    }, {
      'NODE_ENV': (config.production) ? '"production"' : '"development"',
      'BROWSER': (config.production) ? '"false"' : '"true"',
      'DOCS_VERSION': JSON.stringify(serverlessPackageJSON.version)
    })
  return {
    ...config.dev && {
      devtool: '#cheap-module-eval-source-map',
    },
    module: {
      noParse: [/\.min\.js/, /autoit.js/],
      loaders: [

        // *.md => consumed via phenomic special webpack loader
        // allow to generate collection and rss feed.
        {
          // phenomic requirement
          test: /\.md$/,
          loader: phenomicLoader,
          // config is in phenomic.contentLoader section below
          // so you can use functions (and not just JSON) due to a restriction
          // of webpack that serialize/deserialize loader `query` option.
        },

        // *.json => like in node, return json
        // (not handled by webpack by default)
        {
          test: /\.json$/,
          loader: 'json-loader',
        },

        // *.js => babel + eslint
        {
          test: /\.js$/,
          loaders: [
            `babel-loader${
              config.dev
              ? '?cacheDirectory=true&presets[]=babel-preset-react-hmre'
              : '?cacheDirectory=true'
            }`,
            'eslint-loader?fix',
          ],
          include: [
            path.resolve(__dirname, 'scripts'),
            path.resolve(__dirname, 'src'),
          ],
        },

        // ! \\
        // by default *.css files are considered as CSS Modules
        // And *.global.css are considered as global (normal) CSS

        // *.css => CSS Modules
        {
          test: /\.css$/,
          exclude: /\.global\.css$/,
          include: path.resolve(__dirname, 'src'),
          loader: ExtractTextPlugin.extract(
            'style-loader',
            [ `css-loader?modules&importLoaders=1&localIdentName=${
                config.production
                ? '[hash:base64:5]'
                : '[path][name]--[local]--[hash:base64:5]'
              }`,
              'postcss-loader',
            ].join('!'),
          ),
        },
        // *.global.css => global (normal) css
        {
          test: /\.global\.css$/,
          include: path.resolve(__dirname, 'src'),
          loader: ExtractTextPlugin.extract(
            'style-loader',
            [ 'css-loader', 'postcss-loader' ].join('!'),
          ),
        },
        // copy assets and return generated path in js
        {
          test: /\.(html|ico|jpe?g|png|gif)$/,
          loader: 'file-loader' +
            '?name=[path][name].[hash].[ext]&context=' +
            path.join(__dirname, config.source),
        },
        // svg as raw string to be inlined
        {
          test: /\.svg$/,
          loader: 'raw-loader',
        },
      ],
    },

    phenomic: {
      context: path.join(__dirname, config.source),
      feedsOptions: {
        title: pkg.name,
        site_url: pkg.homepage,
      },
      feeds: {
        'feed.xml': {
          collectionOptions: {
            filter: { layout: 'Post' },
            sort: 'date',
            reverse: true,
            limit: 20,
          },
        },
      },
      defaultHead: {
        layout: 'Post',
        comments: true,
      },
    },

    postcss: (webpack) => [
      // require("stylelint")(),
      require('postcss-cssnext')({ browsers: 'last 2 versions' }),
      // require('postcss-import')({
      //   addDependencyTo: webpack
      // }),
      // require("postcss-reporter")(),
      /* do math with resolve( ) */
      require('postcss-math'),
      /* require global variables */
      require('postcss-simple-vars')({
        variables: function variables () {
          // var file = './src/_variables.js';
          // delete require.cache[path.join(__dirname, file)];
          // return require(file);
          var vars = require('./src/_variables')
          // console.log('global css vars', vars)
          return vars
        },
        onVariables: function (variables) {
          // console.log(variables)
        },
        unknown: function unknown (node, name, result) {
          node.warn(result, 'Unknown variable ' + name)
        }
      }),
      /* enable nested css selectors like Sass/Less */
      require('postcss-nested'),
      ...config.production ? [
        require('postcss-browser-reporter')(),
      ] : [],
    ],

    plugins: [
      new ExtractTextPlugin('[name].[hash].css', { disable: config.dev }),
      ...config.production && [
        new webpack.optimize.DedupePlugin(),
        new webpack.optimize.UglifyJsPlugin(
          { compress: { warnings: false } }
        ),
      ],
      new webpack.DefinePlugin({
        'process.env': processVars
      }),
    ],

    output: {
      path: path.join(__dirname, config.destination),
      publicPath: config.baseUrl.pathname,
      filename: '[name].[hash].js',
    },

    resolve: {
      extensions: [ '.js', '.json', '' ],
      root: [ path.join(__dirname, 'node_modules') ],
    },
    resolveLoader: { root: [ path.join(__dirname, 'node_modules') ] },
  }
}

// you might want to export a default config for another usage ?
// export default makeConfig()
