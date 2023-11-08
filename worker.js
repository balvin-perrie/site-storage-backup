chrome.action.onClicked.addListener(tab => {
  chrome.scripting.executeScript({
    target: {
      tabId: tab.id
    },
    func: (tabId, href) => {
      const observe = port => {
        port.onMessage.addListener(request => {
          console.log(request);

          if (request.method === 'get-data') {
            port.postMessage({
              method: 'data',
              object: {
                page: location.href,
                cookie: document.cookie.split(';').map(c => {
                  const i = c.indexOf('=');
                  return [c.substring(0, i), c.substring(i + 1)].filter(a => a[0]);
                }),
                localStorage: Object.entries(localStorage)
              }
            });
          }
          else if (request.method === 'set-data') {
            (request.object.localStorage || []).forEach(([key, value]) => {
              localStorage.setItem(key, value);
            });
            (request.object.cookie || []).forEach(([key, value]) => {
              document.cookie = key + '=' + value;
            });
          }
          else if (request.method === 'close') {
            for (const e of document.querySelectorAll('dialog.sistba')) {
              e.remove();
            }
            chrome.runtime.onConnect.removeListener(observe);
            if (request.page) {
              if (confirm(`Reload to "${request.page}"`)) {
                location.replace(request.page);
              }
            }
          }
        });
      };

      chrome.runtime.onConnect.addListener(observe);

      for (const e of document.querySelectorAll('dialog.sistba')) {
        e.remove();
      }

      const dialog = document.createElement('dialog');
      dialog.classList.add('sistba');
      dialog.style = `
        width: min(90vw, 550px);
        height: min(90vh, 400px);
        border: none;
        padding: 0px;
        overflow: hidden;
        z-index: 1000000000;
        margin: auto;
      `;
      const iframe = document.createElement('iframe');
      iframe.activeElement = document.activeElement;
      iframe.style = `
        color-scheme: light;
        background-color: #fff;
        border: none;
        width: 100%;
        height: 100%;
      `;
      dialog.append(iframe);
      document.body.append(dialog);
      iframe.onload = () => iframe.contentWindow.postMessage({
        pairs: window.pairs
      }, '*');
      iframe.src = chrome.runtime.getURL('/data/popup/index.html') + '?href=' + encodeURIComponent(href) + '&id=' + tabId;
      dialog.showModal();
    },
    args: [tab.id, tab.url]
  }).catch(e => {
    console.error(e);

    chrome.action.setBadgeText({
      tabId: tab.id,
      text: 'E'
    });
    chrome.action.setTitle({
      tabId: tab.id,
      title: e.message || 'Unknown Error'
    });
    chrome.action.setBadgeBackgroundColor({
      tabId: tab.id,
      color: 'red'
    });
  });
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
