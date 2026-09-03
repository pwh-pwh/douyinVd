import { assertEquals, assertRejects } from "@std/assert";
import { getVideoInfo } from "./douyin.ts";

const originalFetch = globalThis.fetch;
const originalLog = console.log;

function stubFetch(body: string) {
  globalThis.fetch = () => Promise.resolve(new Response(body, { status: 200 }));
}

function restore() {
  globalThis.fetch = originalFetch;
  console.log = originalLog;
}

function silenceLogs() {
  console.log = () => {};
}

const VIDEO_ID = "v0200fg10000cabc123";
const VIDEO_SNIPPET = `"video":{"play_addr":{"uri":"${VIDEO_ID}"`;
const EXPECTED_VIDEO_URL =
  `https://www.iesdouyin.com/aweme/v1/play/?video_id=${VIDEO_ID}&ratio=1080p&line=0`;
const STATS_SNIPPET =
  `"statistics":{"aweme_id":"123456","comment_count":10,"digg_count":20,"play_count":30,"share_count":40,"collect_count":50},`;
const AUTHOR_SNIPPET = `"nickname": "alice", "signature": "hello world"`;
const DESC_SNIPPET = `"desc": "a title"`;
const CREATE_TIME_SNIPPET = `"create_time": 1700000000`;
const IMAGE_SNIPPET =
  `{"uri":"tos-cn-i-0813/abc","url_list":["https://p3-sign.douyinpic.com/tos-cn-i-0813/abc~tplv.jpeg"]}`;

Deno.test("returns video_url when statistics are missing", async () => {
  silenceLogs();
  stubFetch(VIDEO_SNIPPET);
  try {
    const info = await getVideoInfo("https://v.douyin.com/fake");
    assertEquals(info.video_url, EXPECTED_VIDEO_URL);
    assertEquals(info.type, "video");
    assertEquals(info.aweme_id, null);
    assertEquals(info.comment_count, null);
    assertEquals(info.digg_count, null);
    assertEquals(info.share_count, null);
    assertEquals(info.collect_count, null);
  } finally {
    restore();
  }
});

Deno.test("parses stats fields when statistics are present", async () => {
  silenceLogs();
  stubFetch(
    `${VIDEO_SNIPPET} ${STATS_SNIPPET} ${AUTHOR_SNIPPET} ${DESC_SNIPPET} ${CREATE_TIME_SNIPPET}`,
  );
  try {
    const info = await getVideoInfo("https://v.douyin.com/fake");
    assertEquals(info.video_url, EXPECTED_VIDEO_URL);
    assertEquals(info.aweme_id, "123456");
    assertEquals(info.comment_count, 10);
    assertEquals(info.digg_count, 20);
    assertEquals(info.share_count, 40);
    assertEquals(info.collect_count, 50);
    assertEquals(info.nickname, "alice");
    assertEquals(info.signature, "hello world");
    assertEquals(info.desc, "a title");
    const expectedDate = new Date(1700000000 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const expectedCreateTime =
      `${expectedDate.getFullYear()}-${pad(expectedDate.getMonth() + 1)}-${pad(expectedDate.getDate())} ${pad(expectedDate.getHours())}:${pad(expectedDate.getMinutes())}:${pad(expectedDate.getSeconds())}`;
    assertEquals(info.create_time, expectedCreateTime);
  } finally {
    restore();
  }
});

Deno.test("returns image_url_list when statistics are missing", async () => {
  silenceLogs();
  stubFetch(IMAGE_SNIPPET);
  try {
    const info = await getVideoInfo("https://v.douyin.com/fake");
    assertEquals(info.type, "img");
    assertEquals(info.video_url, "");
    assertEquals(info.image_url_list, [
      "https://p3-sign.douyinpic.com/tos-cn-i-0813/abc~tplv.jpeg",
    ]);
    assertEquals(info.aweme_id, null);
    assertEquals(info.digg_count, null);
  } finally {
    restore();
  }
});

Deno.test("throws only when neither video nor images can be extracted", async () => {
  silenceLogs();
  stubFetch(`{"foo":"bar"}`);
  try {
    await assertRejects(
      () => getVideoInfo("https://v.douyin.com/fake"),
      Error,
      "No video or image content found in the response.",
    );
  } finally {
    restore();
  }
});
