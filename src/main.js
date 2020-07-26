class ChunkedFileReader {
  constructor(file, { chunkSize, fileSize = file.size }) {
    this.file = file;
    this.chunkCount = Math.ceil(fileSize / chunkSize);
    this.chunkSize = chunkSize;
    this.fileSize = fileSize;
    this.currentChunk = -1;

    this.done = false;
  }

  nextChunk() {
    this.currentChunk += 1;

    const { currentChunk, chunkSize, fileSize, file } = this;
    const start = currentChunk * chunkSize;
    const end = start + chunkSize >= fileSize ? fileSize : start + chunkSize;

    this.done = start + chunkSize >= fileSize;

    return file.slice(start, end).arrayBuffer();
  }
}

class SparkWorkerMD5 {
  constructor() {
    this.workerURL = "./spark.worker.js";
  }

  ready() {
    this.worker = new Worker(this.workerURL);

    return new Promise((resolve) => {
      this.worker.onmessage = (e) => {
        if (e.data === "ready") {
          resolve();
        }
      };
    });
  }

  append(buffer) {
    // here we assume that the worker message listener is synchronous
    this.worker.postMessage(buffer);
  }

  end() {
    return new Promise((resolve, reject) => {
      this.worker.postMessage("done");

      this.worker.onmessage = (e) => {
        resolve(e.data);
        this.worker.terminate();
      };

      this.worker.onerror = reject;
    });
  }
}

class WasmWorkerMD5 extends SparkWorkerMD5 {
  constructor() {
    super();
    this.workerURL = "./wasm.worker.js";
  }
}

class WasmJsMD5 {
  async ready() {
    this.md5 = await hashwasm.createMD5();
  }

  append(arrayBuffer) {
    return this.md5.update(new DataView(arrayBuffer));
  }

  end() {
    return this.md5.digest();
  }
}

class SparkJsMD5 {
  ready() {
    this.spark = new SparkMD5.ArrayBuffer();
  }

  append(arrayBuffer) {
    return this.spark.append(arrayBuffer);
  }

  end() {
    return this.spark.end();
  }
}

const md5 = async function (Ctor, file, config) {
  const task = new Ctor();
  const reader = new ChunkedFileReader(file, config);

  await task.ready();
  while (!reader.done) {
    await task.append(await reader.nextChunk());
  }

  return task.end();
};

document.getElementById("file").addEventListener("change", async function (e) {
  const file = e.target.files[0];
  const run = async function (Ctor, fileSize) {
    const start = performance.now();
    const hash = await md5(Ctor, file, {
      chunkSize: 2 * 1024 * 1024,
      fileSize,
    });
    const time = performance.now() - start;
    console.log(Ctor.name, { time, hash });

    return time;
  };

  const result = {};

  for (let i = 10; i < 510; i += 10) {
    const fileSize = i * 1024 * 1024;
    const exe = (Ctor) => run(Ctor, fileSize);

    console.log(`${i} M`);
    result[i] = [];

    for (const Ctor of [WasmJsMD5, WasmWorkerMD5, SparkJsMD5, SparkWorkerMD5]) {
      result[i].push(await exe(Ctor));
    }

    console.log("============");
  }

  // for (let i = 50; i < 1024; ) {
  //   const fileSize = i * 1024 * 1024;
  //   const exe = (Ctor) => run(Ctor, fileSize);

  //   console.log(`${i} M`);
  //   result[i] = [];

  //   for (const Ctor of [WasmJsMD5, WasmWorkerMD5, SparkJsMD5, SparkWorkerMD5]) {
  //     result[i].push(await exe(Ctor));
  //   }

  //   console.log("============");

  //   if (i < 300) {
  //     i += 50;
  //   } else {
  //     i += 100;
  //   }
  // }

  console.log((window.result = result));
});
