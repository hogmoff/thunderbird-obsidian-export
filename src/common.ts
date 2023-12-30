// TODO: Why isn't this working even when the "dom" lib is enabled in tsconfig?
declare const browser: any;

export async function getSetting(name: string) {
  // Convenience wrapper to get a setting from local storage.
  // @ts-ignore
  return (await browser.storage.local.get(name))[name];
}

export function toDateString(d: Date) {
  var datestring = d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2)
    + "T" + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
  return datestring;
}

// Check API to Obsidian
export async function checkApi() {
  const { obsidianScheme, obsidianHost, obsidianPort } =
    await browser.storage.local.get([
      "obsidianScheme",
      "obsidianHost",
      "obsidianPort",
    ]);
  const url = obsidianScheme + "://" + obsidianHost + ":" + obsidianPort + "/";
  return fetch(url, {
    method: "GET",
  });
}

// Export E-Mail to Obsidian
export async function sendEmailToApi(noteName: string, text: string) {
  const { obsidianScheme, obsidianHost, obsidianPort, obsidianToken, obsidianNotePath } =
    await browser.storage.local.get([
      "obsidianScheme",
      "obsidianHost",
      "obsidianPort",
      "obsidianToken",
      "obsidianNotePath",
    ]);
  const url = obsidianScheme + "://" + obsidianHost + ":" + obsidianPort + "/vault/" + obsidianNotePath + noteName + ".md";
  return fetch(url, {
    method: "PUT",
    headers: { "Authorization": "Bearer " + obsidianToken, "Content-Type": "text/markdown" },
    body: text,
  });
}

// Export File to Obsidian
export async function sendFileToApi(fileName: string, content: File, contentType: string) {
  const { obsidianScheme, obsidianHost, obsidianPort, obsidianToken } =
    await browser.storage.local.get([
      "obsidianScheme",
      "obsidianHost",
      "obsidianPort",
      "obsidianToken",
    ]);
  var xhr = new XMLHttpRequest();
  xhr.open("PUT", obsidianScheme + "://" + obsidianHost + ":" + obsidianPort + "/vault/" + fileName);
  xhr.setRequestHeader("Authorization", "Bearer " + obsidianToken);
  xhr.setRequestHeader("Content-Type", contentType);
  xhr.send(content);
  xhr.status;
  return fileName;
}
