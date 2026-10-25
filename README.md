<p align="center"><img src="assets/ada.svg" width="64" alt="Ada"></p>
<h1 align="center">Ada plugins</h1>
<p align="center">Themes and extensions for <a href="https://github.com/zF4ke/ada">Ada</a>.</p>

## Find a package

| Plugin | What it adds | Runs in |
| --- | --- | --- |
| [Google Calendar and Tasks](packages/releases/ada.google-calendar-1.1.0.ada-plugin) | Read and manage events and tasks | Ada server |
| [Discord](packages/releases/ada.discord-1.1.0.ada-plugin) | Read messages and import selected history | Ada server |
| [Orchid](packages/releases/ada.theme-orchid-1.1.0.ada-plugin) | Violet accents, dark appearance | Desktop app |
| [Paper](packages/releases/ada.theme-paper-1.1.0.ada-plugin) | Warm light appearance | Desktop app |
| [Counter](packages/releases/example.counter-1.1.0.ada-plugin) | A small working plugin example | Ada server |

Themes and connections require experimental Ada 0.16.2. Google and Discord are also included with Ada.

## Install in Ada

Open **Settings > Plugins > Browse**, paste this catalog URL and choose **Browse catalog**.

```text
https://raw.githubusercontent.com/zF4ke/ada-plugins/main/catalog.json
```

Choose where to install the package. For a theme, select **Use theme**. Other plugins start disabled; review their requested access before enabling them.

Connect accounts in the plugin's **Settings**. Updating a compiled connection view may require Ada to prepare a checked build.

[Create a plugin](DEVELOPMENT.md) | [Plugin guide](https://github.com/zF4ke/ada/blob/master/docs/guide/plugins.md)
