## Mustang

### 🐎 这个小工具可以让你用来下载网易云音乐的单曲，专辑，或者歌单。

**本工具所收集的歌曲来源于互联网，转载的目的在于传递更多信息及用于网络分享，并不代表本人赞同其观点和对
其真实性负责，也不构成任何其他建议**

## DEMO
![Mustang download single song](./mustang.gif)

## 安装

```bash
npm install mustangjs -g
```

## 使用

mustang 可以下载单曲 专辑 或者歌单。

*下载单曲 -i 后面是要下载的歌曲ID*

```bash
mustang -i 123456
```
*下载单曲 指定下载位置 默认为当前文件夹下的 ./downloads 文件夹*

```bash
mustang -i 123456 -d ~/Public
```

*下载专辑或者歌单 使用 -t 参数 **p** 代表 歌单，**a** 代表专辑， **s** 代表单曲， 默认为单曲*
**未测试非常大(>50首)的专辑或者歌单**
```bash
mustang -t a -i 123456
```

## 致谢

下载部分的算法一定程度上借鉴了 [musicAPI](https://github.com/LIU9293/musicAPI)，🙏！