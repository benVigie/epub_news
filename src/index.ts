#!/usr/bin/env node

import path from "node:path";
import dotenv from "dotenv";
import chalk from "chalk";
import prompts from "prompts";
import { Command, OptionValues } from "commander";
import { DateTime } from "luxon";
import EpubNews, { EpubArticle } from "./epub_news.js";

// Globals and tools
const program = new Command();
const dt: DateTime = DateTime.now().setLocale("fr");
let prg_options: OptionValues;

// Manage script parameters and parse them from CLI to make them available through the options global
program
  .name("epub_news")
  .description("Fetch RSS feeds from online media and create an ebook. Better way to read news from e-ink tablets !")
  .version("1.0.0")
  .option("-i, --interactive", "select which article to keep in the news feeds", false)
  .option("-p, --path <path>", "default path to export epub", "./ if no DEFAULT_EXPORT_PATH set in env")
  .option("-t, --title <title>", "ebook title", dt.toLocaleString(DateTime.DATE_FULL))
  .option("-e, --envPath <path>", "Path to the env file to load (if any)", ".env")
  .option("-d, --debug", "Debug options", false);
program.parse();
prg_options = program.opts();

// Load environment variables from file if specified
dotenv.config({ path: prg_options.envPath });

async function main() {
  const epub = new EpubNews(prg_options.debug);
  let epubContent: EpubArticle[] = [];
  let customCss: string = "";
  let epubCover: string | undefined;

  // First, retrieve feeds from env
  const envRssFeeds = process.env.RSS_FEEDS;
  if (!envRssFeeds) {
    console.error(chalk.bold.red("Missing environment variable RSS_FEEDS."));
    console.error(
      chalk.bold.yellow(
        "You need to add the RSS feeds you want to monitor into the RSS_FEEDS env var (comma separated).",
      ),
    );
    process.exit(1);
  }
  const rssFeeds = envRssFeeds.split(",").map((url) => url.trim());

  try {
    let parsed: string[] = [];
    for (const rssFeed of rssFeeds) {
      // First, retrieve articles from the RSS feed
      const feedList = await epub.listArticlesFromFeed(rssFeed);
      // Removed already seen ones if any and added the remaining to the seen list to avoid having several times the sames ones from same media feeds
      feedList.articles = feedList.articles.filter((news) => (news.guid ? !parsed.includes(news.guid) : true));
      parsed = parsed.concat(feedList.articles.map((news) => (news.guid ? news.guid : "")));

      // If we're in interactive mode, allow the user to filter the articles he wants to keep
      if (prg_options.interactive) {
        console.info(chalk.bold.magenta(feedList.feedTitle));
        const questions = [
          {
            type: "multiselect",
            name: "selection",
            message: "Select the articles you want to read",
            choices: feedList.articles.map((news) => {
              return { title: news.title, value: news, selected: false };
            }),
            hint: "- Space & Left/Right to toggle. Return to submit",
          },
        ];
        const response = await prompts(questions as any);
        feedList.articles = response.selection;
      }

      // Retrieve and format articles
      const epubData = await epub.getEpubDataFromArticles(rssFeed, feedList.articles);
      // Add articles to our epub list
      epubContent = epubContent.concat(epubData.articles);
      // Set cover and custom css if we need to
      if (!epubCover) epubCover = epubData.cover;
      if (epubData.customCss && !customCss.includes(epubData.customCss)) customCss += epubData.customCss;
    }

    // Finally, create the ebook !
    const filePath = path.join(process.env.DEFAULT_EXPORT_PATH || prg_options.path, `${prg_options.title}.epub`);
    const generation = await epub.generateEpubNews(filePath, prg_options.title, epubContent, customCss, epubCover);
    console.log(
      chalk.green("\nEbook Generated Successfully!"),
      chalk.cyan(filePath),
      chalk.gray(`(${generation.result})` + "\n"),
    );
  } catch (err) {
    console.error(chalk.bold.red("Failed to generate Ebook because of ", err));
  }
}

// Enter script
main();
