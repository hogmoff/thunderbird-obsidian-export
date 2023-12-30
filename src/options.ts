import { checkApi, getSetting } from "./common";

declare const browser: any;
declare const btnSave: HTMLButtonElement;
declare const btnRefreshNotebooks: HTMLButtonElement;

const default_map: { [key: string]: string | number | boolean } = {
  obsidianScheme: "http",
  obsidianHost: "127.0.0.1",
  obsidianPort: 27123,
  obsidianToken: "",
  obsidianShowNotifications: "onFailure",
  obsidianSubjectTrimRegex: "",
  obsidianAuthorTrimRegex: "",
  obsidianDateFormat: "D T",
  obsidianNoteTitleTemplate: "{{subject}} from {{author}}",
  obsidianNoteHeaderTemplate: "---\ncreated: {{created}}\nupdated: {{updated}}\nrelated: {{related}}\nauthor: {{author}}\nsubject: {{subject}}\n" +
    "date: {{date}}\ntags: {{tags}}\nattachments: {{attachments}}\n---\n\n",
  obsidianNoteFormat: "text/plain",
  obsidianAttachments: "attach",
  obsidianNoteTags: "email",
  obsidianNoteTagsFromEmail: true,
  obsidianNotePath: "mails/",
  obsidianAttachmentsPath: "attachments/",
};

async function checkObsidianConnection() {

  let response;
  try {
    response = await checkApi();
  } catch (e) {
    return {
      working: false,
      message:
        "Pinging Obsidian failed. Please check that Obsidian is running and the LOCAL Rest API is enabled.",
    };
  }

  return { working: true, message: "" };
}

async function updateConnectionStatus() {
  const connectionStatus = document.getElementById(
    "obsidianStatus"
  ) as HTMLInputElement;
  const { working, message } = await checkObsidianConnection();
  if (working) {
    connectionStatus.style.color = "blue";
    connectionStatus.value = "working";
  } else {
    connectionStatus.style.color = "red";
    connectionStatus.value = message;
  }

  return working;
}

async function displayUrl() {
  (document.getElementById("obsidianUrl") as HTMLInputElement).value =
    (document.getElementById("obsidianScheme") as HTMLInputElement).value +
    "://" +
    (document.getElementById("obsidianHost") as HTMLInputElement).value +
    ":" +
    (document.getElementById("obsidianPort") as HTMLInputElement).value;
}

async function savePrefs() {
  for (const setting in default_map) {
    const element = document.getElementById(setting) as HTMLInputElement;
    let value;
    if (element.type === "checkbox") {
      value = element.checked;
    } else {
      value = element.value;
    }
    browser.storage.local.set({ [setting]: value });
  }

  await displayUrl();
  await updateConnectionStatus();

}

async function initOptions() {
  btnSave.addEventListener("click", savePrefs);

  // Try to obtain the settings from local storage. If not possible, fall back to the defaults.
  for (const setting in default_map) {
    const currentValue = await getSetting(setting);
    // 'false' is a valid value. Only check for 'null' and 'undefined'.
    const newValue = currentValue != null ? currentValue : default_map[setting];
    await browser.storage.local.set({ [setting]: newValue });
  }

  // Set values of the UI
  for (const setting in default_map) {
    const element = document.getElementById(setting) as HTMLInputElement;
    const value = await getSetting(setting);
    if (element.type === "checkbox") {
      element.checked = value;
    } else {
      element.value = value;
    }
  }

  await displayUrl();

  const working = await updateConnectionStatus();
  if (!working) {
    return;
  }

}

document.addEventListener("DOMContentLoaded", initOptions, { once: true });
