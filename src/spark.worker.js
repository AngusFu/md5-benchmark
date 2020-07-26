importScripts("https://unpkg.com/spark-md5@3.0.1/spark-md5.js");

Promise.resolve(new SparkMD5.ArrayBuffer()).then((spark) => {
  self.postMessage("ready");

  self.onmessage = (e) => {
    if (e.data === "done") {
      self.postMessage(spark.end());
    } else {
      spark.append(e.data);
    }
  };
});
