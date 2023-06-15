import { Calendar, Diff } from "./calendar";
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

function getDiffs(): DiffGroup[] {
  const html = getCalendarPage();
  // const html = HtmlService.createHtmlOutputFromFile("test.html").getContent(); // DEBUG
  const calendars = getCalendarInfo(html);

  const diffGroups: DiffGroup[] = [];
  calendars.forEach(newCal => {
    const old = Calendar.restore(newCal.getName());
    if (old !== null) {
      const ds = old.compare(newCal, ["19:00～21:00"])
      if (ds.length > 0) {
        diffGroups.push(new DiffGroup(newCal.getName(), ds));
      }
    }
    newCal.store();
  });
  return diffGroups;
}

function getCalendarPage(): string {
  const crawler = new Crawler();
  
  crawler.request("get", "https://yoyaku.sports.metro.tokyo.lg.jp/web/index.jsp", undefined);
  Utilities.sleep(1000);
  crawler.request("post",
    "https://yoyaku.sports.metro.tokyo.lg.jp/web/rsvWTransInstSrchVacantAction.do",
    {displayNo: "pawae1000"},
  );
  Utilities.sleep(1000);
  crawler.request("post",
    "https://yoyaku.sports.metro.tokyo.lg.jp/web/rsvWTIM_Action.do",
    getPayload("searchCondition"),
  );
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
  Utilities.sleep(1000);
  const content = crawler.request("post",
    "https://yoyaku.sports.metro.tokyo.lg.jp/web/rsvWGetInstSrchInfAction.do",
    getPayload("search"),
  );
  return content;
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

function getCalendarInfo(content: string): Calendar[] {
  content = normalizeHtml(content);
  const doc = XmlService.parse(content);
  const root = doc.getRootElement();
  const parser = new Parser(root);
  const tables = parser.find({name: "table", class: "tcontent"});
  const dates = parseDates(tables[1]);
  const courts = tables.slice(2).map(t => Calendar.fromTable(t, dates));
  return courts;
}

function parseDates(table: GoogleAppsScript.XML_Service.Element): string[] {
  const parser = new Parser(table);
  const list = parser.find({name: "tr", class: undefined})
  // const year = list[0];
  const dates = list.slice(1);
  return dates.map(e => e.getValue().trim());
}

function getPayload(name: string): string {
  // @ts-ignore
  return payloads[name].map(v => `${v.key}=${v.value}`).join("&");
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
