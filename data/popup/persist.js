chrome.storage.local.get({
  'backup.local.storage': true,
  'backup.cookie': true,
  'backup.disk': true,
  'backup.synced': false,
  'restore.local.storage': true,
  'restore.cookie': true
}, prefs => {
  for (const [name, value] of Object.entries(prefs)) {
    const e = document.getElementById(name);
    if (e) {
      e.checked = value;
    }
  }
  document.dispatchEvent(new Event('change'));
});

document.addEventListener('change', ({target}) => {
  if (target.tagName === 'INPUT' && target.id) {
    chrome.storage.local.set({
      [target.id]: target.checked
    });
  }
});
