class ChunkedFileReader {
  constructor(file, { chunkSize }) {
    this.file = file;
    this.chunkCount = Math.ceil(file.size / chunkSize);
    this.chunkSize = chunkSize;
    this.currentChunk = -1;

    this.done = false;
  }

  nextChunk() {
    this.currentChunk += 1;

    const { currentChunk, chunkSize, file } = this;
    const start = currentChunk * chunkSize;
    const end = start + chunkSize >= file.size ? file.size : start + chunkSize;

    this.done = start + chunkSize >= file.size;

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

const runJob = async function (JobType, file) {
  const md5 = new JobType();
  const reader = new ChunkedFileReader(file, { chunkSize: 2 * 1024 * 1024 });

  await md5.ready();
  while (!reader.done) {
    await md5.append(await reader.nextChunk());
  }

  return md5.end();
};

document.getElementById("file").addEventListener("change", async function (e) {
  const file = e.target.files[0];

  const run = async function (Job) {
    const start = performance.now();
    const hash = await runJob(Job, file);
    console.log(Job.name, { time: performance.now() - start, hash });
  };

  await run(WasmJsMD5);
  await run(WasmWorkerMD5);
  await run(SparkJsMD5);
  await run(SparkWorkerMD5);
});
