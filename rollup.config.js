//,import babel from 'rollup-plugin-babel';
import buble from 'rollup-plugin-buble';
import babelrc from 'babelrc-rollup';
import istanbul from 'rollup-plugin-istanbul';

let pkg = require('./package.json');
let external = Object.keys(pkg.dependencies);

export default {
  entry: 'lib/index.js',
  plugins: [
    //,babel(babelrc()),
    buble()
    //,istanbul({
    //,  exclude: ['test/**/*', 'node_modules/**/*']
    //,})
  ],
  external: external,
  targets: [
    {
      dest: pkg['main'],
      format: 'cjs',
      sourceMap: false
    },
    {
      dest: pkg['jsnext:main'],
      format: 'es',
      sourceMap: false
    }
  ]
};
