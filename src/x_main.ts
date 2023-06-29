import { Calendar, Diff, ScheduleCondition } from "./calendar";
import { Crawler } from "./crawler";
import { Parser } from "./htmlParser";
import { Notifier } from "./notification";

class DiffGroup {
  private name: string;
  private diffs: Diff[];

  constructor(name: string, diffs: Diff[]) {
    this.name = name;
    this.diffs = diffs;
  }

  toString(): string {
    const diffStr = this.diffs.map(d => d.toString()).join("\n")
    return `[${this.name}]\n${diffStr}`
  }
}

function main() {
  if (isMaintainanceTime()) {
    Logger.log("It's under the maintainance.")
    return;
  }
  const notifier = getNotifierClient();
  try {
    const diffGroups = getDiffs();
    if (diffGroups.length > 0) {
      const message = createDiffMessage(diffGroups);
      notifier.send(message);
    } else {
      Logger.log("diffなし");
    }
  } catch (error) {
    Logger.log(error);
    notifier.send(`エラーが発生しました。 ${error}`);
  }
}

function isMaintainanceTime() {
  const d = new Date();
  return (d.getDate() === 27 && d.getHours() >= 12 || d.getDate() === 28 && d.getHours() < 9);
}

function getDiffs(): DiffGroup[] {
  const pages = getCalendarPages();
  // const pages = [{ // DEBUG
  //   html: HtmlService.createHtmlOutputFromFile("test.html").getContent(),
  //   year: "2023",
  //   month: "6",
  // }];
  const diffGroups: DiffGroup[] = [];
  pages.forEach(p => {
    const calendars = getCalendarInfo(p);

    calendars.forEach(newCal => {
      const old = Calendar.restore(newCal.getName());
      if (old !== null) {
        const ds = old.compare(newCal, [
          /*
            [検知対象日時]
            ScheduleCondition(weekday, time)
            - weekday と time の AND (積集合) 条件で指定する
            - weekday: 曜日 (月～日)
            - time: 利用時間 (HH:mm-HH:mm の形式で、07:00-09:00 から 19:00-21:00 まで)
            - * はすべてを表す
            ScheduleCondition 同士は OR (和集合) 条件で結合する
          */
          new ScheduleCondition("*", "19:00-21:00"),
          new ScheduleCondition("土", "*"),
          new ScheduleCondition("日", "*"),
        ]);
        if (ds.length > 0) {
          diffGroups.push(new DiffGroup(newCal.getName(), ds));
        }
      }
      newCal.store();
    });
  });
  return diffGroups;
}

interface CalendarPage {
  html: string;
  year: string;
  month: string;
}

const MAX_RETRY = 4;

function getCalendarPages(): CalendarPage[] {
  const crawler = new Crawler();

  let ym: string[] = [];
  for (let i = 1; i <= MAX_RETRY; i++) {
    crawler.request("get", "https://yoyaku.sports.metro.tokyo.lg.jp/web/index.jsp", undefined);
    Utilities.sleep(1000);
    const preSearchPage = crawler.request("post",
      "https://yoyaku.sports.metro.tokyo.lg.jp/web/rsvWTransInstSrchVacantAction.do",
      {displayNo: "pawae1000"},
    );
    const searchPath = getSearchPagePath(preSearchPage);
    Utilities.sleep(1000);
    const searchPage = crawler.request("post",
      "https://yoyaku.sports.metro.tokyo.lg.jp" + searchPath,
      getPayload("searchCondition"),
    );

    try {
      ym = getDispYM(searchPage);
    } catch(e) {
      Utilities.sleep(10000);
      Logger.log(`Error occured: ${e}. Retry...`)
      if (i == MAX_RETRY) {
        throw e;
      }
      continue;
    }
    break;
  }
  Utilities.sleep(1000);
  crawler.request("post",
    "https://yoyaku.sports.metro.tokyo.lg.jp/web/rsvWTransInstSrchPpsAction.do",
    getPayload("selectSports"),
  );
  Utilities.sleep(1000);
  crawler.request("post",
    "https://yoyaku.sports.metro.tokyo.lg.jp/web/rsvWTransInstSrchMultipleAction.do",
    getPayload("searchConditionWithSports"),
  );
  const contents: CalendarPage[] = [];
  ym.forEach(ym => {
    const year = ym.substring(0, 4);
    const month = ym.substring(4, 6);
    Utilities.sleep(1000);
    const content = crawler.request("post",
      "https://yoyaku.sports.metro.tokyo.lg.jp/web/rsvWGetInstSrchInfAction.do",
      getPayload("search", [
        {key: "selectM", value: month},
        {key: "selectYMD", value: `${ym}01`},
      ]),
    );
    contents.push({
      html: content,
      year: year,
      month: month,
    });
    Utilities.sleep(1000);
    crawler.request("post",
      "https://yoyaku.sports.metro.tokyo.lg.jp/web/rsvWInstSrchVacantBackAction.do",
      getPayload("back"),
    );
  });
  return contents;
}

function getSearchPagePath(html: string): string {
  const pattern = /var gRsvWTransInstSrchMultipleAction ?= ?'([^']+)';/g;
  const match = pattern.exec(html);
  if (match !== null) {
    return match[1];
  } else {
    throw new Error('No match found');
  }
}

function getDispYM(html: string): string[] {
  const pattern = /<input type="hidden" name="dispYMD" value="(\d+)">/g;
  let match;
  const matches = [];

  while ((match = pattern.exec(html)) !== null) {
    matches.push(match[1].substring(0, 6));
  }

  if (matches.length > 0) {
    return matches;
  } else {
    for (let i = 0; i < html.length; i+=500) {
      const element = html.substring(i, i+500);
      Logger.log(element);
    }
    throw new Error('No displayed months found');
  }
}

function normalizeHtml(html: string): string {
  const removals = [
    /<meta[^>]*>/gi,
    /<link[^>]*>/gi,
    /<img[^>]*>/gi,
    /<br[^>]*>/gi,
    /<input[^>]*>/gi,
    /nowrap/gi,
  ];
  removals.forEach(v => html = html.replace(v, ''));
  return html;
}

function getCalendarInfo(cal: CalendarPage): Calendar[] {
  const content = normalizeHtml(cal.html);
  const doc = XmlService.parse(content);
  const root = doc.getRootElement();
  const parser = new Parser(root);
  const tables = parser.find({name: "table", class: "tcontent", attrs: undefined});
  const dates = parseDates(tables[1]);
  const courts = tables.slice(2).map(t => Calendar.fromTable(t, dates, cal.year, cal.month));
  return courts;
}

function parseDates(table: GoogleAppsScript.XML_Service.Element): string[] {
  const parser = new Parser(table);
  const list = parser.find({name: "tr", class: undefined, attrs: undefined})
  // const year = list[0];
  const dates = list.slice(1);
  return dates.map(e => e.getValue().trim());
}

function getPayload(name: string, append: KeyValue[] = []): string {
  // @ts-ignore
  return payloads[name].concat(append).map(v => {
    return `${v.key}=${v.value}`;
  }).join("&");
}

function getNotifierClient(): Notifier {
  const properties = PropertiesService.getScriptProperties();
  const botToken = properties.getProperty("SLACK_BOT_TOKEN");
  if (botToken === null) {
    throw Error("SLACK_BOT_TOKEN is not found");
  }
  const channel = properties.getProperty("NOTIFICATION_CHANNEL");
  if (channel === null) {
    throw Error("NOTIFICATION_CHANNEL is not found");
  }
  return new Notifier(botToken, channel);
}

function createDiffMessage(diffs: DiffGroup[]): string {
  const diffsMsg = diffs.map(d => d.toString()).join("\n\n");
  return `施設空き情報に変更が見つかりました\n${diffsMsg}`;
}
