
function median(series, count) {
	var odd = count % 2;
	var half = (count - odd) * 0.5;
	return odd
		? series[half]
		: (series[half-1] + series[half]) * 0.5;
}

function stats(series) {
	series = series && series.sort();
	var count = series && series.length;
	var sum = 0;
	var sumDev = 0;
	var min = +Infinity;
	var max = -Infinity;
	var i, t;
	for ( i = 0; i < count; i++ ) {
		t = series[i];
		sum += t;
		(t < min) && (min = t);
		(t > max) && (max = t);
	}
	var avg = count ? sum / count : sum;
	for ( i = 0; i < count; i++ ) {
		t = series[i];
		sumDev += Math.pow(t-avg, 2);
	}
	var variance = count ? sumDev / count : sumDev;
	return {
		sum: sum,
		count: count,
		avg: avg,
		min: min,
		max: max,
		variance: variance,
		stdDev: Math.sqrt(variance),
		median: count ? median(series, count) : 0
	};
}

function beforeFile(file) {
	var time = this.time;
	var last = this.lastFile;
	var ltime = last && last.time;
	var ltotal;
	var lover;
	var now = Date.now();
	if ( !time ) {
		this.time = time = {
			start: now,
			plugins: [],
			files: [],
			over: [],
			total: 0
		}
	}
	if ( ltime ) {
		ltime.total = ltotal = now - ltime.start;
		ltime.over = lover = now - ltime.startPlugin;
		time.files.push(ltotal);
		time.over.push(lover);
	}
	if ( file ) {
		file.time = {
			start: now,
			startPlugin: now,
			plugins: [],
			total: 0
		};
	} else {
		var plugins = this.plugins;
		time.total = now - time.start;
		time.files = stats(time.files);
		time.over = stats(time.over);
		time.plugins = time.plugins.map(function(v, i) {
			v = stats(v);
			var name = plugins[i].name;
			v.name = name || 'plugin #'+(i+1);
			return v;
		});
	}
}

function afterPlugin() {
	var pIndex = this.pIndex;
	if (this.plugins[pIndex].sync) return;
	var time = this.time;
	var file = this.file;
	var ftime = file.time;
	var startPlugin = ftime.startPlugin;
	var now = Date.now();
	var timePlugin = now - startPlugin;
	var timePluginArray = time.plugins[pIndex];
	ftime.startPlugin = now;
	if ( !timePluginArray ) {
		time.plugins[pIndex] = timePluginArray = [];
	}
	timePluginArray.push(timePlugin);
	ftime.plugins[pIndex] = timePlugin;
}

var timePlugins = {
	median,
	stats,
	beforeFile,
	afterPlugin
};

export default timePlugins;
