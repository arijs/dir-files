
var hasOwnProperty = Object.prototype.hasOwnProperty;

export default function skipPlugin(opt) {
	var filter = opt && (opt instanceof Function ? opt : opt.filter);
	return {
		name: opt.name || 'skip',
		pluginTimeIgnore: hasOwnProperty.call(opt, 'pluginTimeIgnore')
			? opt.pluginTimeIgnore
			: true,
		filter: filter,
		sync: function skip(/*file*/) {
			return this.SKIP;
		}
	};
}
