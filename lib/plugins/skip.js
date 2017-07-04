
export default function skipPlugin(opt) {
	var filter = opt && (opt instanceof Function ? opt : opt.filter);
	return {
		name: opt.name || 'skip',
		filter: filter,
		sync: function skip(/*file*/) {
			return this.SKIP;
		}
	};
}
