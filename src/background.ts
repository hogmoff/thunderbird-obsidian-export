import { DateTime } from "luxon";
import { sendEmailToApi, sendFileToApi, toDateString, getSetting, checkObsidianConnection } from "./common";

declare const browser: any;
declare const messenger: any;

//////////////////////////////////////////////////
// Export by context menu
//////////////////////////////////////////////////

browser.menus.create({
  id: "export_to_obsidian",
  title: "Obsidian Export",
  // https://developer.thunderbird.net/add-ons/mailextensions/supported-ui-elements#menu-items
  contexts: ["message_list", "page", "frame", "selection"],
});

async function handleContextMenu(
  info: { menuItemId: string },
  tab: { id: number }
) {
  if (info.menuItemId === "export_to_obsidian") {
    await getAndProcessMessages(tab, {});
  }
}

//////////////////////////////////////////////////
// Export by hotkey
//////////////////////////////////////////////////

async function handleHotkey(command: string) {
  // Called if hotkey is pressed.

  if (command === "export_to_obsidian") {
    // Only the active tab is queried. So the array contains always exactly one element.
    const [activeTab] = await messenger.tabs.query({
      active: true,
      currentWindow: true,
    });
    await getAndProcessMessages(activeTab, {});
  }
}

function onlyWhitespace(str: string) {
  return str.trim().length === 0;
}

function renderString(inputString: string, context: { [key: string]: any }) {
  // Replace all occurrences of "{{x}}" in a string.
  // Take the new value from the "context" argument.
  // Leave the string unmodified if the new value isn't in the "context".

  // Don't use a template engine like nunchucks:
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/content_security_policy#valid_examples

  const re = /{{.*?}}/g;
  const matches = inputString.match(re);
  if (!matches) {
    return inputString;
  }

  let renderedString = inputString;
  for (const match of matches) {
    const trimmedMatch = match.slice(2, -2).trim();
    if (!(trimmedMatch in context)) {
      // Don't replace if there is no matching value.
      // It would result in an "undefined" string.
      continue;
    }
    renderedString = renderedString.replace(match, context[trimmedMatch]);
  }
  return renderedString;
}

//////////////////////////////////////////////////
// Export by menu button
//////////////////////////////////////////////////

async function getAndProcessMessages(tab: { id: number }, info: any) {
  // Called after button is clicked or hotkey is pressed.

  let success = true;
  let notificationIcon = "../images/obsidian-icon.png";
  let notificationTitle = "Obsidian export failed";
  let notificationMessage;

  // Check for Opsidian API token. If it isn't present, we can skip everything else.
  const apiToken = await getSetting("obsidianToken");
  if (!apiToken) {
    notificationMessage = "API token missing.";
    success = false;
  } else {
    const mailHeaders = await browser.messageDisplay.getDisplayedMessages(
      tab.id
    );

    // Process the mails and check for success.
    const results = await Promise.all(mailHeaders.map(processMail));
    for (const error of results) {
      if (error) {
        console.error(error);
        success = false;
      }
    }

    // Prepare the notification text.
    if (success) {
      notificationIcon = "../images/obsidian-icon.png";
      notificationTitle = "Obsidian export succeeded";
      notificationMessage =
        results.length == 1
          ? "Exported one email."
          : `Exported ${results.length} emails.`;
    } else {
      notificationMessage = "Please check Obsidian and the developer console.";
    }
  }

  // Emit the notification if configured.
  const showNotifications = await getSetting("obsidianShowNotifications");
  console.log(showNotifications);
  console.log(success);
  console.log(notificationMessage);
  if (
    (success && ["always", "onSuccess"].includes(showNotifications)) ||
    (!success && ["always", "onFailure"].includes(showNotifications))
  ) {
    browser.notifications.create({
      type: "basic",
      iconUrl: notificationIcon,
      title: notificationTitle,
      message: notificationMessage,
    });
  }
}

async function processMail(mailHeader: any) {
  //////////////////////////////////////////////////
  // Mail content
  //////////////////////////////////////////////////

  // https://webextension-api.thunderbird.net/en/91/messages.html#messages-messageheader
  if (!mailHeader) {
    return "Mail header is empty";
  }

  // Add a note with the email content
  // Customization
  const regexStringSubject = (await getSetting("obsidianSubjectTrimRegex")) || "";
  const regexStringAuthor = (await getSetting("obsidianAuthorTrimRegex")) || "";
  const dateFormat = (await getSetting("obsidianDateFormat")) || "";
  const obsidianDateStr = toDateString(new Date());
  const trimmedSubject =
    regexStringSubject === ""
      ? mailHeader.subject
      : mailHeader.subject.replace(new RegExp(regexStringSubject), "");
  const trimmedAuthor =
    regexStringAuthor === ""
      ? mailHeader.author
      : mailHeader.author.replace(new RegExp(regexStringAuthor), "");
  const formattedDate =
    dateFormat === ""
      ? mailHeader.date
      : DateTime.fromJSDate(mailHeader.date).toFormat(dateFormat);
  const renderingContext = {
    ...mailHeader,
    subject: trimmedSubject,
    author: trimmedAuthor,
    date: formattedDate,
    created: obsidianDateStr,
    updated: obsidianDateStr,
    related: "",
  };
  const obsidianAttachmentsPath = (await getSetting("obsidianAttachmentsPath")) || "";

  // Title
  const titleRendered = renderString(
    (await getSetting("obsidianNoteTitleTemplate")) || "",
    renderingContext
  );

  const data: {
    title: string;
    body?: string;
    body_html?: string;
  } = {
    title: titleRendered,
  };

  // Body
  type ContentType = "text/html" | "text/plain";
  type Mail = { body: string; contentType: ContentType; parts: Array<Mail> };

  function getMailContent(mail: Mail, contentType: ContentType, content = "") {
    if (!mail) {
      return content;
    }
    if (mail.body && mail.contentType === contentType) {
      content += mail.body;
    }
    if (mail.parts) {
      for (const part of mail.parts) {
        content = getMailContent(part, contentType, content);
      }
    }
    return content;
  }

  // If there is selected text, prefer it over the full email.
  const selectedText = await browser.helper.getSelectedText();
  if (onlyWhitespace(selectedText)) {
    const mailObject = await browser.messages.getFull(mailHeader.id);

    // text/html and text/plain seem to be the only used MIME types for the body.
    const mailBodyHtml = getMailContent(mailObject, "text/html");
    const mailBodyPlain = getMailContent(mailObject, "text/plain");
    if (!mailBodyHtml && !mailBodyPlain) {
      return "Mail body is empty";
    }

    // If the preferred content type doesn't contain data, fall back to the other content type.
    const contentType = await getSetting("obsidianNoteFormat");
    if ((contentType === "text/html" && mailBodyHtml) || !mailBodyPlain) {
      console.log("Sending complete email in HTML format.");
      data["body_html"] = mailBodyHtml;
    }
    if ((contentType === "text/plain" && mailBodyPlain) || !mailBodyHtml) {
      console.log("Sending complete email in plain format.");
      data["body"] = mailBodyPlain;
    }
  } else {
    console.log("Sending selection in plain format.");
    data["body"] = selectedText;
  }


  //////////////////////////////////////////////////
  // Tags
  //////////////////////////////////////////////////

  // User specified tags are stored in a comma separated string.
  const userTagsString = await getSetting("obsidianNoteTags");
  let tags = userTagsString ? userTagsString.split(",") : [];

  const includeMailTags = await getSetting("obsidianNoteTagsFromEmail");
  if (includeMailTags) {
    // Find each tag key in the mapping and return the corresponding, human readable value.
    const tagMapping = await browser.messages.listTags();
    const mailTags = mailHeader.tags.map((tagKey: string) => {
      return tagMapping.find((mapping: any) => mapping.key === tagKey).tag;
    });

    tags = tags.concat(mailTags);
  }

  //////////////////////////////////////////////////
  // Attachments
  //////////////////////////////////////////////////

  var fileList = [];
  const filePrefix = obsidianAttachmentsPath + toDateString(mailHeader.date).replace('T', ' ') + " ";
  const howToHandleAttachments = await getSetting("obsidianAttachments");
  if (howToHandleAttachments === "attach") {
    const attachments = await browser.messages.listAttachments(mailHeader.id);
    for (let att of attachments) {
      let file = await browser.messages.getAttachmentFile(
        mailHeader.id,
        att.partName
      );
      // Export attachments to Obsidian
      fileList.push(await sendFileToApi(filePrefix + att.name, file, att.contentType));
    }
  }

  // Note Name
  const noteName = titleRendered;

  const renderTemplate = (await getSetting("obsidianNoteHeaderTemplate")) || "";

  // add Tags to header
  var propertiesWithTags = renderTemplate;
  if (tags.length > 0) {
    // add Header
    var tagsString = "";
    if (propertiesWithTags.indexOf("---") < 0) {
      propertiesWithTags = "---\ntags: {{tags}}\n---\n" + propertiesWithTags;
    }
    var indexTags = propertiesWithTags.indexOf("{{tags}}");
    var indexEnd = propertiesWithTags.lastIndexOf("---");
    for (let tag of tags) {
      tagsString += "  - " + tag + "\n";
    }
    tagsString = tagsString.trimEnd();

    // insert tags
    if (indexTags < 0 && indexEnd >= 0) {
      // to the end
      propertiesWithTags = propertiesWithTags.substring(0, indexEnd) + "tags: \n" + tagsString + "\n" + propertiesWithTags.substring(indexEnd);
    }
    else if (indexTags >= 0) {
      // to the keyword {{tags}} 
      propertiesWithTags = propertiesWithTags.replace("{{tags}}", "\n" + tagsString);
    }
  }

  // Add user defined header info.  
  var header = renderString(propertiesWithTags, renderingContext);

  // Add attachments
  const obsidianAttachments = (await getSetting("obsidianAttachments")) || "";
  if (obsidianAttachments == "attach" && fileList.length > 0) {
    var attach = "\n";
    for (let file of fileList) {
      attach += "  - \"[[" + file + "|" + file.replace(filePrefix, '') + "]]\"\n";
    }
    header = header.replace("{{attachments}}", attach.trimEnd());
  }
  else {
    header = header.replace("{{attachments}}", "");
  }

  var body = "";

  // Body
  if (data["body_html"] != null && data["body_html"].length > 0) {
    body = data["body_html"];
  }
  else if (data["body"] != null && data["body"].length > 0) {
    body = data["body"];
  }

  // first check API
  let resultConn = await checkObsidianConnection();
  if (!resultConn.working) {
    return resultConn.message;
  }

  // send note to Obsidian
  // https://javascript.info/fetch
  let response = await sendEmailToApi(noteName, header + body);
  if (!response.ok) {
    return `Failed to create note: ${await response.text()}`;
  }

  return null;
}

// Three ways to export notes: by menu button, hotkey or context menu.
browser.browserAction.onClicked.addListener(getAndProcessMessages);
messenger.commands.onCommand.addListener(handleHotkey);
browser.menus.onClicked.addListener(handleContextMenu);

// Only needed for testing.
export {
  getAndProcessMessages,
  handleContextMenu,
  handleHotkey,
  onlyWhitespace,
  processMail,
  renderString,
};
