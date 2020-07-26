# md5-benchmark

## Result

Running result with a file in 1GB ——

![](https://tva1.sinaimg.cn/large/007S8ZIlgy1gh4s5tc6rxj310o0563z5.jpg)

### 10-500 MB [result](https://gallery.echartsjs.com/editor.html?c=xgQwZH5vLk&v=10)

Step=50

![](https://tva1.sinaimg.cn/large/007S8ZIlgy1gh4u7b9jfgj310n0u0myp.jpg)

### 100-1000 MB [result](https://gallery.echartsjs.com/editor.html?c=xNUYurFgrt&v=9)

Step=100

![](https://tva1.sinaimg.cn/large/007S8ZIlgy1gh4uoj2bwxj30yu0u03zq.jpg)

## Note

Generate a file in large size ——

```shell
dd if=/dev/zero of=test bs=1m count=1024
```
