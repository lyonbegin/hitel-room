/* HITEL GitHub Pages adapter -- static snapshot access, NOT a live Zocbo API.
 * Loaded by the Pages-only builder before the original UI scripts.
 * No source server, credentials or third-party requests are impersonated.
 */
(function () {
  'use strict';
  const script = document.currentScript;
  const base = new URL('./', script && script.src || location.href);
  const nativeFetch = window.fetch.bind(window);
  const unavailable = 'GitHub Pages 정적 화면입니다. 원본 화면 보존 자료는 볼 수 있으나 실시간 문제은행 조회는 지원되지 않습니다. 원본 문제은행 열기에서 확인해 주십시오.';

  function response(data, code) {
    return new Response(JSON.stringify(data), {
      status: code,
      headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}
    });
  }

  function staticFile(path, options) {
    const url = new URL(path, base);
    return nativeFetch(url.href, Object.assign({}, options, {credentials: 'omit'}))
      .then(function (r) {
        const contentType = r.headers.get('content-type') || '';
        if (r.ok && contentType.toLowerCase().includes('json')) return r;
        return response({ok:false, error: '저장된 원본 JSON 파일을 찾지 못했습니다: ' + path}, 404);
      })
      .catch(function () {
        return response({ok:false, error:'원본 화면 보존 파일을 불러올 수 없습니다.'}, 503);
      });
  }

  function restrictedError() {
    return Promise.resolve(response({ok:false, error:unavailable, reason:unavailable, staticPreview:true}, 503));
  }

  window.fetch = function (input, init) {
    let url;
    try {
      url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url, document.baseURI);
    } catch (_) {
      return nativeFetch(input, init);
    }
    // Only intercept the unavailable Railway Zocbo API on this origin.
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/zocbo/')) {
      return nativeFetch(input, init);
    }
    if (url.pathname === '/api/zocbo/faithful-index') {
      return staticFile('zocbo-faithful-index.json', init);
    }
    if (url.pathname === '/api/zocbo/faithful-page') {
      const id = url.searchParams.get('case') || '';
      if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) {
        return Promise.resolve(response({ok:false, error:'잘못된 원본 화면 식별자입니다.'},400));
      }
      return staticFile('zocbo-faithful-pages/' + id + '.json', init);
    }
    if (url.pathname === '/api/zocbo/menu-data') {
      const slug = url.searchParams.get('slug') || '';
      if (!/^[a-z0-9_]{1,60}$/.test(slug)) {
        return Promise.resolve(response({ok:false,error:'잘못된 원본 메뉴 이름입니다.'},400));
      }
      return staticFile('zocbo-original-data/' + slug + '.json', init);
    }
    // These endpoints require a running server and external source queries.
    // Return an explicit JSON error rather than a GitHub Pages HTML 404.
    return restrictedError();
  };
  console.info('[HITEL Pages] archived Zocbo metadata enabled; live search is unavailable');
})();
