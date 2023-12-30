# Obsidian Export Thunderbird Addon

Easily export your Thunderbird emails to Obsidian.


## Features

- Export a text selection, a single email or multiple emails to Obsidian.
- Export by clicking the button or pressing the hotkey (by default "Ctrl+Alt+O")
- Add metadata to the title and body of the note:
  - Set a template for note title and body.
  - Trim the author or subject by regex. For example, remove "Re:" or "Fwd:".
  - Include the date in a [custom format](https://moment.github.io/luxon/#/formatting?id=table-of-tokens).
  - Take a look at [this section](#include-metadata) for details.
- Add tags and attachments from the email.

## Installation

- Via [Thunderbird addon store](https://addons.thunderbird.net/en/thunderbird/addon/obsidian-export/) (preferred)
- Via manual import:
  1. Download the artifacts from the github build action: <https://github.com/hogmoff/thunderbird-obsidian-export/.github/workflows/build.yml>.
  2. Extract the archive and look for "obsidian-export.xpi".
  3. Import to Thunderbird via the addon manager -> "Install Add-on From File...".

## Usage

1. Start Obsidian.
2. Install the [Community Plugin](https://help.obsidian.md/Extending+Obsidian/Community+plugins) [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api), enable the plugin and copy the API key.
3. Configure the plugin:
  - set scheme, host and port to the fields.
  - Paste the API token to the token field.
  - Save.
4. Select any email. The Obsidian button should be at the menu.
5. Export the email by clicking the button. If there is any problem, a notification will pop up. After a successful export, the email should be in the specified Obsidian folder.


### Include metadata

In this section you will find some examples how to include email metadata into note title or body. All metadata of the [mail header object](https://webextension-api.thunderbird.net/en/latest/messages.html#messages-messageheader) can be used.

By default, the note title template is `{{subject}} from {{author}}`. I. e. the `subject` and `author` keys are searched in the mail header object and inserted into the template if found. Since the subject contains often strings like `Re:` or `Fwd:`, these can be removed by defining a regex. The setting is called "Trim subject". For me, the regex `^(((Re|Fw|Fwd):|(\[.*\])) ?)*` works best.

It is also possible to insert some metadata (properties) at the top of the note body. This can be done by defining a template in the "Note header" setting. The template should be specified in markdown syntax for the [properties](https://help.obsidian.md/Editing+and+formatting/Properties). Words surrounded by double curly brackets will be attempted to be replaced by the corresponding metadata, as done in the note title.

The following two code snippets show examples of what the templates might look like.

Plain text with closing separation line:

```
---
From: {{author}}
Subject: {{subject}}
Date: {{date}}
To: {{recipients}}
---
```

```

Table with closing separation line:

```text
|         |                |
| ------- | -------------- |
| From    | {{author}}     |
| Subject | {{subject}}    |
| Date    | {{date}}       |
| To      | {{recipients}} |

---

```

## Troubleshooting

What to do when the export failed?

1. Check that Opsidian is running and the Local REST API plugin is enabled.
2. Check that the plugin is configured correctly. There is a status field. The status should be "working". Make sure the API token is set correctly.
3. Check the developer console. Usually it can be opened by pressing "Ctrl + Shift + I" or going to "Extras -> Developer Tools". There should be some error message.
4. If the previous steps didn't resolve the issue, you can open a github issue.

## Related Projects

- https://github.com/marph91/thunderbird-joplin-export Many thanks to marph91! Without this great project this project wouldn't exist.

## Further ressources

- <https://webextension-api.thunderbird.net/en/latest/>
- <https://developer.thunderbird.net/add-ons/resources>

## Changelog

### 0.1

- Initial release.
