//,import babel from 'rollup-plugin-babel';
import buble from 'rollup-plugin-buble';
//,import babelrc from 'babelrc-rollup';
//,import istanbul from 'rollup-plugin-istanbul';

let pkg = require('./package.json');
let external = Object.keys(pkg.dependencies);
let file = 'dir-files.js';

export default {
  entry: 'test/index_test.esm.js',
  plugins: [
    //,babel(babelrc()),
    buble()
    //,istanbul({
    //,  exclude: ['test/**/*', 'node_modules/**/*']
    //,})
  ],
  //,external: external,
  external: function(path) {
    //,console.log('rc/ext', path);
    var lenDiff = path.length - file.length;
    if ( lenDiff >= 0 && path.substr(lenDiff) === file ) {
      return true;
    }
    return external[path];
  },
  targets: [
    {
      dest: 'dist/test/index_test.js',
      format: 'cjs',
      sourceMap: false
    }
  ]
};
