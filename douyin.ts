import {string} from "npm:zod@3.24.2";

const pattern = /"video":{"play_addr":{"uri":"([a-z0-9]+)"/;
const cVUrl =
  "https://www.iesdouyin.com/aweme/v1/play/?video_id=%s&ratio=1080p&line=0";

const statsRegex = /"statistics"\s*:\s*\{([\s\S]*?)\},/;

// 使用正则表达式匹配 nickname 和 signature
const regex = /"nickname":\s*"([^"]+)",\s*"signature":\s*"([^"]+)"/;
const ctRegex = /"create_time":\s*(\d+)/;
const descRegex = /"desc":\s*"([^"]+)"/;

interface DouyinVideoInfo {
  // ID
  aweme_id: string | null;
  // 评论数
  comment_count: number | null;
  // 点赞数
  digg_count: number | null;
  // 分享数
  share_count: number | null;
  // 收藏数
  collect_count: number | null;
  // 作者昵称
  nickname: string | null;
  // 作者签名
  signature: string | null;
  // 标题
  desc: string | null;
  // 创建时间
  create_time: string | null;
  // 视频链接
  video_url: string | null;
  // 类型
  type: string | null;
  // 图片链接列表
  image_url_list: string[] | null;
}

// 定义格式化函数
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // 月份从0开始
  const day = String(date.getDate()).padStart(2, '0');

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

async function doGet(url: string): Promise<Response> {
  const headers = new Headers();
  headers.set(
    "User-Agent",
    "Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G973U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36",
  );
  const resp = await fetch(url, { method: "GET", headers });
  return resp;
}

async function parseImgList(body: string):Promise<string[]> {
  const content = body.replace(/\\u002F/g, "/").replace(/\//g, '/')
  // console.log(content)
  const reg = /{"uri":"[^\s"]+","url_list":\["(https:\/\/p\d{1,2}-sign.douyinpic.com\/.*?)"/g;
  const urlRet = /"uri":"([^\s"]+)","url_list":/g

  let imgMatch;
  const firstUrls: string[] = [];
  while ((imgMatch = reg.exec(content)) !== null) {
    firstUrls.push(imgMatch[1]);
  }
  // console.log('firstUrls.length:',firstUrls.length)
// console.log(firstUrls)

  let urlMatch;
  const urlList: string[] = [];
  while ((urlMatch = urlRet.exec(content)) !== null) {
    urlList.push(urlMatch[1])
  }
  const urlSet = new Set(urlList)
  // console.log('urlSet.size:',urlSet.size)
  const rList = []

  for (let urlSetKey of urlSet) {
    // console.log('urlSetKey:',urlSetKey)

    let t = firstUrls.find((item) => {
      return item.includes(urlSetKey);
    });
    if (t) {
      rList.push(t)
    }
  }

//打印rList结果
// console.log(rList)
// console.log(rList.length);

// 过滤掉包含 /obj/ 的链接
  const filteredRList = rList.filter(url => !url.includes("/obj/"));

// 输出过滤后的结果
//   console.log(filteredRList);
  console.log('filteredRList.length:',filteredRList.length)
  return filteredRList;
}

async function getVideoInfo(url: string): Promise<DouyinVideoInfo> {
  let type = "video";
  let img_list: string[] = [];
  let video_url = "";
  const resp = await doGet(url);
  const body = await resp.text();
  const match = pattern.exec(body);
  if (!match || !match[1]) {
    type = "img";
  }
  if (type == "video") {
    video_url = cVUrl.replace("%s", match![1]);
  } else {
    img_list = await parseImgList(body)
  }
  if (!video_url && img_list.length === 0) {
    throw new Error("No video or image content found in the response.");
  }
  const auMatch = body.match(regex);
  const ctMatch = body.match(ctRegex);
  const descMatch = body.match(descRegex);
  const statsMatch = body.match(statsRegex);

  const douyinVideoInfo: DouyinVideoInfo = {
    aweme_id: null,
    comment_count: null,
    digg_count: null,
    share_count: null,
    collect_count: null,
    nickname: null,
    signature: null,
    desc: null,
    create_time: null,
    video_url: video_url,
    type: type,
    image_url_list: img_list,
  };

  if (statsMatch) {
    const innerContent = statsMatch[0]; // 整个匹配结果

    // 提取具体字段值
    const awemeIdMatch = innerContent.match(/"aweme_id"\s*:\s*"([^"]+)"/);
    const commentCountMatch = innerContent.match(/"comment_count"\s*:\s*(\d+)/);
    const diggCountMatch = innerContent.match(/"digg_count"\s*:\s*(\d+)/);
    const playCountMatch = innerContent.match(/"play_count"\s*:\s*(\d+)/);
    const shareCountMatch = innerContent.match(/"share_count"\s*:\s*(\d+)/);
    const collectCountMatch = innerContent.match(/"collect_count"\s*:\s*(\d+)/);
    douyinVideoInfo.aweme_id = awemeIdMatch ? awemeIdMatch[1] : null;
    douyinVideoInfo.comment_count = commentCountMatch ? parseInt(commentCountMatch[1]) : null;
    douyinVideoInfo.digg_count = diggCountMatch ? parseInt(diggCountMatch[1]) : null;
    douyinVideoInfo.share_count = shareCountMatch ? parseInt(shareCountMatch[1]) : null;
    douyinVideoInfo.collect_count = collectCountMatch ? parseInt(collectCountMatch[1]) : null;
  }

  if (auMatch) {
    douyinVideoInfo.nickname = auMatch[1];
    douyinVideoInfo.signature = auMatch[2];
  }

  if (ctMatch) {
    const date = new Date(parseInt(ctMatch[1]) * 1000);
    douyinVideoInfo.create_time = formatDate(date);
  }
  if (descMatch) {
    douyinVideoInfo.desc = descMatch[1];
  }
  console.log(douyinVideoInfo);
  return douyinVideoInfo;
}

async function getVideoId(url: string): Promise<string> {
  const resp = await doGet(url);
  const body = await resp.text();
  const match = pattern.exec(body);
  if (!match || !match[1]) throw new Error("Video ID not found in URL");
  return match[1];
}

async function getVideoUrl(url: string): Promise<string> {
  const id = await getVideoId(url);
  const downloadUrl = cVUrl.replace("%s", id);
  return downloadUrl;
}

// const url = "https://v.douyin.com/JyCk5gy";
// const downloadUrl = await getVideoInfo(url);
// console.log(downloadUrl);
// https://v.douyin.com/nA55ZPqlGOc/
// https://v.douyin.com/S1Z20qK0spM/



export { getVideoUrl,getVideoInfo };
