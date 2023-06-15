export class Notifier {
  private token: string;
  private channel: string;
  constructor(slackBotToken: string, channel: string) {
    this.token = slackBotToken;
    this.channel = channel;
  }

  send(msg: string) {
    const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
      method: "post",
      headers: {
        "Authorization": `Bearer ${this.token}`,
      },
      payload: {
        "text": msg,
        "channel": this.channel,
      },
      followRedirects: true,
      muteHttpExceptions: true,
    };

    const response = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", options);
    Logger.log(response.getContentText());
  }
}
