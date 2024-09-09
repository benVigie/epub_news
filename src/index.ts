#!/usr/bin/env node

import path from "node:path";
import Parser from "rss-parser";
import "dotenv/config";
import chalk from "chalk";
import https from "https";
import { parse } from "node-html-parser";
import { EPub, EpubOptions } from "@lesjoursfr/html-to-epub";
import { Command, OptionValues } from "commander";
import ora, { Ora } from "ora";
import { DateTime } from "luxon";
import prompts from "prompts";
import terminalLink from "terminal-link";

// Globals and tools
const program = new Command();
const dt: DateTime = DateTime.now().setLocale("fr");
let spinner: Ora;
let prg_options: OptionValues;

// Constants
const FLUX = ["https://www.lemonde.fr/rss/une.xml"];
const CLEAN_DOM_LIST = [
  ".meta.meta__social",
  ".inread.js-services-inread",
  ".aside__iso",
  ".services-carousel",
  ".services.services--footer",
  ".article__reactions",
  ".article__siblings",
  ".sport-jo-nav",
  "#sport-score-board",
  "#sport-score-see-more",
  ".sport-partner",
];

// Manage script parameters and parse them from CLI to make them available through the options global
program
  .name("epub_news")
  .description(
    "Fetch RSS feeds from online media and create an ebook. Better way to read news from e-ink tablets !"
  )
  .version("1.0.0")
  .option(
    "-i, --interactive",
    "select which article to keep in the news feeds",
    false
  )
  .option(
    "-p, --path <path>",
    "default path to export epub",
    process.env.DEFAULT_EXPORT_PATH || "."
  )
  .option(
    "-t, --title <title>",
    "ebook title",
    dt.toLocaleString(DateTime.DATE_FULL)
  )
  .option("-d, --debug", "Debug options", false);
program.parse();
prg_options = program.opts();

export interface LeMondeMediaContent {
  url: string;
  width?: number;
  height?: number;
}

// Custom types
type CustomFeed = { foo: string };
type CustomItem = { "media:content": any };
type Article = { title: string; data: string };

const parser: Parser<CustomFeed, CustomItem> = new Parser({
  customFields: {
    feed: ["foo"],
    item: ["media:content"],
  },
});

async function parseRSSFeed(
  feed_url: string
): Promise<Array<CustomItem & Parser.Item>> {
  const feed = await parser.parseURL(feed_url);
  if (prg_options.debug) console.info(chalk.blue.magenta(feed.title));

  feed.items.forEach((item) => {
    if (prg_options.debug) {
      console.log(
        chalk.blue(`  - ${item.title}`),
        chalk.gray(`(${item.pubDate})`)
      );
    }
  });

  return feed.items;
}

async function retrieveArticle(url: string): Promise<string> {
  if (spinner) spinner.suffixText = chalk.italic.green("downloading...");

  const fetchOptions: https.RequestOptions = {};
  if (process.env.LE_MONDE_COOKIE) {
    fetchOptions["headers"] = { Cookie: process.env.LE_MONDE_COOKIE };
  }
  return new Promise((resolve, reject) => {
    let data = "";

    https.get(url, fetchOptions, (res) => {
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        resolve(data);
      });

      res.on("error", (err: Error) => {
        reject(err);
      });
    });
  });
}

function trimArticleForEpub(title: string, article: string): string | null {
  // Do not compute live feeds from Le Monde
  if (title.startsWith("En direct")) {
    spinner.suffixText = chalk.yellow("is a live stream, skip");
    return null;
  }

  if (spinner) spinner.suffixText = chalk.italic.green("trimming...");

  const root = parse(article);
  // Remove useless nodes
  for (const node_name of CLEAN_DOM_LIST) {
    const nodes = root.querySelectorAll(node_name);
    for (const node of nodes) {
      node.remove();
    }
  }

  const domArticle = root.querySelector(".zone.zone--article");
  if (domArticle) return domArticle.toString();

  // Set the error reason to the spinner and return null article
  spinner.suffixText = chalk.yellow("empty, skip");
  return null;
}

function generateNewsEpub(title: string, coverUrl: string, content: Article[]) {
  // Le Monde already has a image service that resize its article's pictures. If we have specified size in url, change them to a bigger image that suit epub expectations
  if (coverUrl.indexOf("644/322") >= 0) {
    coverUrl = coverUrl.replace("644/322", "1410/2250");
  }

  const epubOptions: EpubOptions = {
    title,
    description: `Les titres du ${dt.toLocaleString(DateTime.DATE_FULL)}`,
    author: "Le Monde",
    cover: coverUrl,
    lang: "fr",
    tocTitle: "Liste des articles",
    appendChapterTitles: false,
    content,
  };
  const filePath = path.join(prg_options.path, `${title}.epub`);
  const epub = new EPub(epubOptions, filePath);
  epub
    .render()
    .then(() => {
      console.log(
        chalk.green("\nEbook Generated Successfully!"),
        chalk.cyan(filePath + "\n")
      );
    })
    .catch((err) => {
      console.error(
        chalk.bold.red("Failed to generate Ebook because of ", err)
      );
    });
}

async function main() {
  // Select the news we want to have in the epub
  let articles: Array<CustomItem & Parser.Item> = [];
  for (const newsFeed of FLUX) {
    const feedNews = await parseRSSFeed(newsFeed);
    articles = articles.concat(feedNews);
  }

  if (prg_options.interactive) {
    const questions = [
      {
        type: "multiselect",
        name: "selection",
        message: "Select the articles you want to read",
        choices: articles.map((article) => {
          return { title: article.title, value: article, selected: true };
        }),
        hint: "- Space & Left/Right to toggle. Return to submit",
      },
    ];
    const response = await prompts(questions as any);
    articles = response.selection;
  }

  // Retrieve articles and format them for the epub
  const epubContent: Array<Article> = [];
  let cover = null;
  for (const article of articles) {
    // Start info spinner
    spinner = ora(chalk.italic(article.title));
    spinner.indent = 2;
    spinner.start();

    if (article.link && article.title) {
      const news = await retrieveArticle(article.link);
      const trimedArticle = trimArticleForEpub(article.title, news);

      // If we have an article, add it to the ebook
      if (trimedArticle) {
        epubContent.push({
          title: article.title,
          data: trimedArticle,
        });
        spinner.suffixText = chalk.green("ok");
        spinner.succeed();
        if (
          cover === null &&
          article["media:content"]["$"]["url"] &&
          article["media:content"]["$"] &&
          article["media:content"]["$"]["url"]
        ) {
          cover = article["media:content"]["$"]["url"];
        }
      } else {
        const link = terminalLink(article.title, article.link);
        spinner.warn(chalk.italic.gray(link));
      }
    } else {
      spinner.warn(chalk.italic.red("No title or link for this news, skip"));
    }
  }

  // Finally, create the ebook !
  generateNewsEpub(prg_options.title, cover, epubContent);
}

// Security check. Without cookie, you can't retrieve membership articles from Le Monde
if (!process.env.LE_MONDE_COOKIE) {
  console.error(
    chalk.bold.yellow("Missing environment variable LE_MONDE_COOKIE.")
  );
  console.error(
    chalk.yellow(
      "It can result in incorrect news fetching for members exclusive articles.\n"
    )
  );
}
main();
