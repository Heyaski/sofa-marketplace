(function () {
	var apiUrl = 'http://localhost:8000';
	var script = document.currentScript;
	if (script && script.src) {
		var match = script.src.match(/[?&]api=([^&]+)/);
		if (match) apiUrl = decodeURIComponent(match[1]);
	}
	var cacheName = 'vizhub-glb-models-v2';
	var cacheOrigin = 'https://glb-cache.vizhub.local';
	var version = 'v=opt4';

	function stableKey(url) {
		try {
			return new URL(url).pathname.toLowerCase();
		} catch (e) {
			return null;
		}
	}

	function cacheRequest(key) {
		var path = key.charAt(0) === '/' ? key.slice(1) : key;
		return new Request(cacheOrigin + '/' + path);
	}

	function withVersion(url) {
		if (!url) return null;
		var low = url.toLowerCase();
		if (
			low.indexOf('x-amz-signature=') >= 0 ||
			low.indexOf('auth_key=') >= 0
		) {
			return url;
		}
		return url + (url.indexOf('?') >= 0 ? '&' : '?') + version;
	}

	function getModelUrl(p) {
		var url = p.model_glb;
		if (!url && p.asset_3d_models && p.asset_3d_models[0]) {
			var u = (p.asset_3d_models[0].file_url || '').toLowerCase();
			var ext = u.split('.').pop().split('?')[0];
			if (['glb', 'gltf', 'usdz'].indexOf(ext) >= 0) {
				url = p.asset_3d_models[0].file_url;
			}
		}
		return withVersion(url);
	}

	function prefetch(url) {
		if (typeof caches === 'undefined' || !url) return;
		var key = stableKey(url);
		if (!key) return;
		caches.open(cacheName).then(function (cache) {
			cache.match(cacheRequest(key)).then(function (cached) {
				if (cached) return;
				fetch(url, { mode: 'cors' }).then(function (res) {
					if (res.ok) cache.put(cacheRequest(key), res);
				}).catch(function () {});
			});
		});
	}

	fetch(apiUrl + '/api/products/?page=1&page_size=8&list_mode=3d')
		.then(function (r) { return r.json(); })
		.then(function (data) {
			if (!data.results || !data.results.length) return;
			data.results.slice(0, 8).forEach(function (p) {
				var url = getModelUrl(p);
				if (url) prefetch(url);
			});
		})
		.catch(function () {});
})();
