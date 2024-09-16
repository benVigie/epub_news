# epub_news
Fetch RSS feeds from online media and create an ebook. Better way to read news from e-ink tablets !

Written with Node.js and Typescript, it will create a cli tool called `epub_news` you can run to generate your ebook news.

So far, it can retrieve latest news from [Le Monde](https://www.lemonde.fr/) ([list of their rss feeds here](https://www.lemonde.fr/actualite-medias/article/2019/08/12/les-flux-rss-du-monde-fr_5498778_3236.html)) and [Gamekult](https://www.gamekult.com/).

> ⚠️ _Le Monde has both public and membership articles. I encourage you to help them if you can! On top of that, some articles behind a paywall will require you to set your website cookie in order to be fetched._

### Installation
Simply run `npm install` to install dev dependencies.

You'll also have to create a `.env` file with these info:
```apacheconf
RSS_FEEDS=https://www.lemonde.fr/rss/une.xml,other,feed,comma,separated
DEFAULT_EXPORT_PATH=/your/epub/export/path # Optional
LE_MONDE_COOKIE="Use your account cookie to be able to retrieve all news from Le Monde" # Optional
```

When ready, you should be able to build the project with `npm run build` and run it with `./dist/epub_news`.

### Usage
```
epub_news [options]

Options:
  -V, --version        output the version number
  -i, --interactive    select which article to keep in the news feeds (default: false)
  -p, --path <path>    default path to export epub (default: "./")
  -t, --title <title>  ebook title (default: "8 septembre 2024")
  -d, --debug          debug options (default: false)
  -h, --help           display help for command
```
