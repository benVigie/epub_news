[![NPM](https://img.shields.io/badge/NPM-%23CB3837.svg?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/epub_news)

# Epub News
Retrieve RSS feeds from online media and create an eBook. A better way to read news on e-ink tablets !

Written in Node.js and Typescript, it creates a cli tool called `epub_news` that you can run to generate your ebook news.

So far, it can retrieve the latest news from [Le Monde](https://www.lemonde.fr/) ([list of their rss feeds here](https://www.lemonde.fr/actualite-medias/article/2019/08/12/les-flux-rss-du-monde-fr_5498778_3236.html)) and [Gamekult](https://www.gamekult.com/).

> ⚠️ _Le Monde has both public and member articles. I encourage you to help them if you can! Also, some articles behind a paywall will require you to set your website cookie in order to be retrieved._

### Installation
To install the `epub_news` cli, simply run `npm install -g epub_news`. It will install the cli tool globally which you can execute by running `epub_news` in your terminal.

#### Configuration
In order to run, `epub_news` needs a config file with important information such as the RSS feeds you want to retrieve for your eBook. You'll need to create an `.env` file with these info:
```apacheconf
RSS_FEEDS=https://www.lemonde.fr/rss/une.xml,other,feed,comma,separated
DEFAULT_EXPORT_PATH=/your/epub/export/path # Optional
LE_MONDE_COOKIE="Use your account cookie to be able to retrieve all news from Le Monde" # Optional
```

#### Usage
```
epub_news [options]

Options:
  -V, --version        Print the version number
  -i, --interactive    Select which article to keep in the news feeds (default: false)
  -p, --path <path>    Default path for epub export (default: "./")
  -t, --title <title>  Ebook title (default: "today's date")
  -e, --envPath <path> Path to the env file to load (default: "./.env")
  -d, --debug          Debug options (default: false)
  -v, --verbose        Print all app operations in terminal (default: true)
  -h, --help           Show tool help
```

### Development
If you fixed a bug or just want to add a new media source, feel free to help !

First, download the source, then run `npm install` to install the dev dependencies.

You'll also need to create a `.env` file as described in the [configuration section](#configuration).

When you're done, you should be able to build the project with `npm run build` and run it with `npm run start`.
