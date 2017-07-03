/*eslint no-console: 0*/

export default function queueDirPlugin(opt) {
	opt || (opt = {});
	var filter = opt.filter;
	return {
		name: 'queueDir',
		filter: function(file) {
			return file.name &&
				file.stat &&
				file.stat.isDirectory() &&
				( !filter || filter(file) );
		},
		sync: function(file) {
			if (opt.verbose) {
				console.log('queueDir', file.dir.sub, file.name);
			}
			var clean = this.fn.enterDirPath(file.dir, file.name, file.stat);
			this.queue = [clean].concat(this.queue);
		}
	};
}
