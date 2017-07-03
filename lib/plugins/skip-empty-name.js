
var skipEmptyNamePlugin = {
	name: 'skipEmptyName',
	sync: function skipEmptyName(file) {
		if (!file.name) {
			return this.SKIP;
		}
	}
};

export default skipEmptyNamePlugin;
