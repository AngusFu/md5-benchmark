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
    this.workerURL = './spark.worker.js';
  }

  ready() {
    this.worker = new Worker(this.workerURL);

    return new Promise(resolve => {
      this.worker.onmessage = e => {
        if (e.data === 'ready') {
          resolve();
        }
      };
    });
  }

  append(buffer) {
    // this.worker.postMessage(buffer);
    this.worker.postMessage(buffer, { transfer: [buffer] });
  }

  end() {
    return new Promise((resolve, reject) => {
      this.worker.postMessage('done');

      this.worker.onmessage = e => {
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
    this.workerURL = './wasm.worker.js';
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
  const start = performance.now();

  while (!reader.done) {
    await task.append(await reader.nextChunk());
  }

  return {
    hash: task.end(),
    cost: performance.now() - start,
  };
};

const initChart = function () {
  return window.echarts.init(document.getElementById('chart'));
};

let chart = null;

document.getElementById('file').addEventListener('change', async function (e) {
  const file = e.target.files[0];
  const run = async function (Ctor, fileSize) {
    return md5(Ctor, file, {
      chunkSize: 2 * 1024 * 1024,
      fileSize,
    }).then(res => res.cost.toFixed(2));
  };

  chart && chart.dispose({});
  chart = initChart();

  const Ctors = [WasmJsMD5, WasmWorkerMD5, SparkJsMD5, SparkWorkerMD5];
  const chunkSizeArray = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];

  const xAxisData = [];
  const legendData = ['WasmJsMD5', 'WasmWorkerMD5', 'SparkJsMD5', 'SparkWorkerMD5'];
  const series = legendData.map(name => ({
    type: 'line',
    name,
    data: [],
  }));
  let chartOptions = null;

  for (let i = 0; i < chunkSizeArray.length; i += 1) {
    const m = chunkSizeArray[i];
    const size = m * 1024 * 1024;

    xAxisData.push(m);
    console.log(`${m} M`);

    for (let j = 0; j < Ctors.length; j += 1) {
      series[j].data.push(await run(Ctors[j], size));
    }

    chartOptions = {
      series,
      legend: { data: legendData },
      tooltip: {
        trigger: 'axis',
        order: 'valueAsc',
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
      },
      yAxis: {
        type: 'value',
        splitLine: {
          show: false,
        },
      },
    };
    chart.setOption(chartOptions);
  }

  console.log(JSON.stringify(chartOptions));
});
