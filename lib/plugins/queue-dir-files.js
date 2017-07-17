/*eslint no-console: 0*/

var hasOwnProperty = Object.prototype.hasOwnProperty;

export default function queueDirFilesPlugin(opt) {
	opt || (opt = {});
	var filter = opt.filter;
	return {
		name: 'queueDirFiles',
		pluginTimeIgnore: hasOwnProperty.call(opt, 'pluginTimeIgnore')
			? opt.pluginTimeIgnore
			: true,
		filter: function(file) {
			return !file.name &&
				file.stat &&
				file.stat.isDirectory() &&
				file.dir.files;
		},
		sync: function(file) {
			var self = this;
			var dir = file.dir;
			var fileList = dir.files;
			if (opt.verbose) {
				console.log('queueDirFiles', dir.sub, file.name, fileList.length);
			}
			var clean = [];
			if ( !(filter instanceof Function) ) {
				filter = void 0;
			}
			fileList.forEach(function queueFile(subFile) {
				subFile = self.fn.subDirPath(file, subFile);
				if (filter && !filter.call(self, subFile)) return;
				clean.push(subFile);
			});
			this.queue = clean.concat(this.queue);
		}
	};
}
