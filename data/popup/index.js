/* global Safe */

const args = new URLSearchParams(location.search);
const tabId = Number(args.get('id'));

const config = {};

try {
  config.location = new URL(args.get('href'));
  document.getElementById('host').value = config.location.host;

  if (config.location.protocol.startsWith('http') === false) {
    document.body.dataset.error = 'Cannot backup or restore this page';
  }
  else {
    chrome.storage.sync.get({
      [config.location.host]: false
    }, prefs => {
      const encrypted = prefs[config.location.host];
      if (encrypted) {
        document.getElementById('clean').disabled = false;
        document.getElementById('restore.synced').disabled = false;
        document.getElementById('restore.synced').encrypted = encrypted;
      }
    });
  }
}
catch (e) {
  document.body.dataset.error = e.message;
}

const port = chrome.tabs.connect(tabId, {
  name: 'access'
});
port.onDisconnect.addListener(() => {
  document.body.dataset.error = 'Communication is broken; Please retry.';
});
port.onMessage.addListener(request => {
  if (request.method === 'data') {
    config.object = request.object;

    document.getElementById('local.storage.count').textContent = ` (${request.object.localStorage.length})`;
    document.getElementById('cookie.count').textContent = ` (${request.object.cookie.length})`;
  }
});
port.postMessage({
  method: 'get-data'
});


document.addEventListener('submit', async e => {
  e.preventDefault();

  const one = document.getElementById('pass.one').value;
  const two = document.getElementById('pass.two').value;
  if (e.submitter.id === 'backup') {
    if (one !== two) {
      return alert('Passwords do not match');
    }

    const o = {
      page: config.object.page
    };
    if (document.getElementById('backup.local.storage').checked) {
      o['localStorage'] = config.object.localStorage;
    }
    if (document.getElementById('backup.cookie').checked) {
      o['cookie'] = config.object.cookie;
    }

    try {
      const safe = new Safe();
      await safe.open(one);
      const encrypted = await safe.encrypt(JSON.stringify(o));

      if (document.getElementById('backup.disk').checked) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([encrypted], {
          type: 'application/binary'
        }));
        a.download = config.location.host + '.enc';
        a.click();
        URL.revokeObjectURL(a.href);
      }
      if (document.getElementById('backup.synced').checked) {
        chrome.storage.sync.set({
          [config.location.host]: encrypted
        }, () => {
          document.getElementById('clean').disabled = false;
          document.getElementById('restore.synced').disabled = false;
          document.getElementById('restore.synced').encrypted = encrypted;
        });
      }
    }
    catch (e) {
      console.error(e);
      alert(e.message);
    }
  }
  if (e.submitter.id.startsWith('restore')) {
    const next = async encrypted => {
      try {
        const safe = new Safe();
        await safe.open(one);
        const content = await safe.decrypt(encrypted);
        const object = JSON.parse(content);

        if (document.getElementById('restore.local.storage').checked === false) {
          object.localStorage = [];
        }
        if (document.getElementById('restore.cookie').checked === false) {
          object.cookie = [];
        }
        if (object.page) {
          const {host} = new URL(object.page);
          if (host !== config.location.host) {
            const msg = `You are about to write "${config.location.host}" from a backup for "${host}". Are you sure?`;
            if (confirm(msg) === false) {
              return;
            }
          }
        }

        port.postMessage({
          method: 'set-data',
          object
        });
        e.submitter.value = 'Done';
        setTimeout(() => port.postMessage({
          method: 'close',
          page: object.page
        }), 2000);
      }
      catch (e) {
        console.error(e);
        alert(e.message || 'Wrong password?');
      }
    };

    if (e.submitter.id.endsWith('.disk')) {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = () => {
        const [file] = input.files;
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            next(reader.result);
          };
          reader.readAsText(file, 'utf-8');
        }
      };
      input.click();
    }
    else if (e.submitter.id.endsWith('.synced')) {
      next(e.submitter.encrypted);
    }
  }
});

document.getElementById('clean').onclick = () => {
  if (confirm('Are you sure you want to remove encrypted data for this site from synced storage?')) {
    chrome.storage.sync.remove(config.location.host, () => {
      document.getElementById('clean').disabled = true;
      document.getElementById('restore.synced').disabled = true;
      delete document.getElementById('restore.synced').encrypted;
    });
  }
};

document.getElementById('show').onclick = e => {
  if (e.target.value === 'Show') {
    e.target.value = 'Hide';
    document.getElementById('pass.one').type = 'text';
    document.getElementById('pass.two').type = 'text';
  }
  else {
    e.target.value = 'Show';
    document.getElementById('pass.one').type = 'password';
    document.getElementById('pass.two').type = 'password';
  }
};

document.getElementById('close').onclick = () => port.postMessage({
  method: 'close'
});

document.addEventListener('change', () => {
  document.getElementById('backup').disabled =
    document.getElementById('backup.local.storage').checked === false &&
    document.getElementById('backup.cookie').checked === false;
});
