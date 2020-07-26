importScripts("https://cdn.jsdelivr.net/npm/hash-wasm");

hashwasm.createMD5().then((md5) => {
  self.postMessage("ready");

  self.onmessage = (e) => {
    if (e.data === "done") {
      self.postMessage(md5.digest());
    } else {
      md5.update(new DataView(e.data));
    }
  };
});
