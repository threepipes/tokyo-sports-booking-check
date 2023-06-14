const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36";
const encoding = "Shift_JIS";

export class Crawler {
  private cookies: string[];

  constructor() {
    this.cookies = [];
  }

  request(method: GoogleAppsScript.URL_Fetch.HttpMethod, url: string, payload: GoogleAppsScript.URL_Fetch.Payload | undefined): string {
    Logger.log(`requesting ${url}...`);
    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: method,
      headers: {
        "Cookie": this.cookies.join("; "),
        "User-Agent": userAgent,
      },
      payload: payload,
      followRedirects: true,
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch(url, options);
    const headers = response.getAllHeaders();
    
    if ("Set-Cookie" in headers) {
      let newCookies = headers["Set-Cookie"];
      
      // If there's only one cookie, put it in an array
      if (typeof newCookies === "string") {
        newCookies = [newCookies];
      }

      // Update our cookies
      // @ts-ignore
      for (const cookie of newCookies) {
        this.cookies.push(cookie.split(";")[0]);
      }
    }
    return response.getContentText(encoding);
  }
}
