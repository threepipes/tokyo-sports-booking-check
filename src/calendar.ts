interface Availability {
  time: string; // format: "HH:mm - HH:mm"
  value: string; // "-" | "x" | number
}

const SCHEDULE_EXPIRED = "－";
const SCHEDULE_FULL = "×";

interface DayAvailability {
  date: string; // format: "<month>/<date>(day)"
  schedule: Availability[];
}

export class Diff {
  private date: string;
  private time: string;
  private before: string;
  private after: string;

  constructor(date: string, time: string, before: string, after: string) {
    this.date = date;
    this.time = time;
    this.before = before;
    this.after = after;
  }

  toString(): string {
    return `${this.date} ${this.time} のステータスが ${this.before} から ${this.after} に変わりました。`
  }
}

function needAlert(fromAvailability: string, toAvailability: string): boolean {
  if (fromAvailability === SCHEDULE_FULL) {
    return toAvailability !== SCHEDULE_FULL && toAvailability !== SCHEDULE_EXPIRED;
  } else if (toAvailability === SCHEDULE_FULL) {
    return fromAvailability !== SCHEDULE_FULL && fromAvailability !== SCHEDULE_EXPIRED;
  }
  return false;
}

export class Calendar {
  private name: string; // spreadsheet sheet name
  private days: DayAvailability[];
  private scheduleNames: string[];

  constructor(name: string, days: DayAvailability[], scheduleNames: string[]) {
    this.name = name;
    this.days = days;
    this.scheduleNames = scheduleNames;
  }

  getName(): string {
    return this.name;
  }

  static fromTable(courtTable: GoogleAppsScript.XML_Service.Element, dates: string[]): Calendar {
    const rows = courtTable.getChildren("tr");
    const courtName = rows[0].getValue().trim();
    const scheduleNames = rows[1].getChildren("td").map(e => e.getValue().trim());
    const schedules = rows.slice(2).map((d, i) => ({
      date: dates[i],
      schedule: d.getChildren("td").map(v => v.getValue().trim()).map((v, j) => ({
        time: scheduleNames[j],
        value: v,
      } as Availability))
    } as DayAvailability));
    return new Calendar(courtName, schedules, scheduleNames);
  }

  private getNewSheet(): GoogleAppsScript.Spreadsheet.Sheet {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(this.name);
    if (sheet === null) {
      // Create a new sheet if it doesn't exist
      return SpreadsheetApp.getActiveSpreadsheet().insertSheet(this.name);
    } else {
      // Clear the existing content
      sheet.clear();
      return sheet;
    }
  }

  store() {
    Logger.log(`storing ${this.name}`);
    const sheet = this.getNewSheet();

    sheet.appendRow(['date', ...this.scheduleNames]);
    
    this.days.forEach((day) => {
      let row = [day.date];
      day.schedule.forEach((availability) => {
        row.push(availability.value);
      });
      sheet.appendRow(row);
    });

    Logger.log("completed storing");
  }

  static restore(name: string): Calendar {
    Logger.log(`restoring ${name}`);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
    if (sheet === null) {
      throw Error(`failed to find sheet: ${name}`);
    }
    const days: DayAvailability[] = [];

    const header = sheet.getRange(1, 2, 1, 7);
    const scheduleNames: string[] = [];
    header.getValues()[0].forEach(v => scheduleNames.push(v));

    const range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8); // Skip the headers
    const values = range.getValues();
    values.forEach((row: any[]) => {
      const dayAvailability: DayAvailability = {
        date: row[0],
        schedule: [],
      };

      for(let i = 1; i < row.length; i++) {
        dayAvailability.schedule.push({
          time: scheduleNames[i - 1],
          value: row[i],
        });
      }
      
      days.push(dayAvailability);
    });
    Logger.log("completed restoring");

    return new Calendar(
      sheet.getName(),
      days,
      scheduleNames,
    )
  }

  compare(calendar: Calendar, targetSchedules: string[]): Diff[] {
    const diffs: Diff[] = [];
    this.days.forEach((d, i) => {
      d.schedule.forEach((s, j) => {
        if (!targetSchedules.includes(s.time)) {
          return;
        }
        const to = calendar.days[i].schedule[j];
        if (needAlert(s.value, to.value)) {
          diffs.push(new Diff(
            d.date,
            s.time,
            s.value,
            to.value,
          ))
        }
      });
    });
    return diffs;
  }
}
