(function () {
	var apiUrl = 'http://localhost:8000';
	var script = document.currentScript;
	if (script && script.src) {
		var match = script.src.match(/[?&]api=([^&]+)/);
		if (match) apiUrl = decodeURIComponent(match[1]);
	}
	var cacheName = 'vizhub-glb-models';
	var version = 'v=opt4';

	function getModelUrl(p) {
		var url = p.model_glb;
		if (!url && p.asset_3d_models && p.asset_3d_models[0]) {
			var u = (p.asset_3d_models[0].file_url || '').toLowerCase();
			var ext = u.split('.').pop().split('?')[0];
			if (['glb', 'gltf', 'usdz'].indexOf(ext) >= 0) url = p.asset_3d_models[0].file_url;
		}
		if (!url) return null;
		return url + (url.indexOf('?') >= 0 ? '&' : '?') + version;
	}

	function prefetch(url) {
		if (typeof caches === 'undefined') return;
		caches.match(url).then(function (cached) {
			if (cached) return;
			fetch(url, { mode: 'cors' }).then(function (res) {
				if (res.ok) caches.open(cacheName).then(function (c) { c.put(url, res); });
			}).catch(function () {});
		});
	}

	fetch(apiUrl + '/api/products/?page=1&page_size=6')
		.then(function (r) { return r.json(); })
		.then(function (data) {
			if (!data.results || !data.results.length) return;
			data.results.slice(0, 6).forEach(function (p) {
				var url = getModelUrl(p);
				if (url) prefetch(url);
			});
		})
		.catch(function () {});
})();
