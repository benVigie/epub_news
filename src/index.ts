#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs";
import "dotenv/config";
import chalk from "chalk";
import { EPub, EpubContentOptions, EpubOptions } from "@lesjoursfr/html-to-epub";
import { Command, OptionValues } from "commander";
import { DateTime } from "luxon";
import createMediaSource from "./media_sources/media_source_factory.js";
import prompts from "prompts";

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
  .option("-p, --path <path>", "default path to export epub", process.env.DEFAULT_EXPORT_PATH || ".")
  .option("-t, --title <title>", "ebook title", dt.toLocaleString(DateTime.DATE_FULL))
  .option("-d, --debug", "Debug options", false);
program.parse();
prg_options = program.opts();

function generateNewsEpub(title: string, content: EpubContentOptions[], customCss: string, cover?: string) {
  const css = fs.readFileSync(path.resolve(import.meta.dirname, "../epub.css"));

  const epubOptions: EpubOptions = {
    title,
    description: `Les titres du ${dt.toLocaleString(DateTime.DATE_FULL)}`,
    author: "Le Monde",
    cover: cover,
    lang: "fr",
    tocTitle: "Liste des articles",
    appendChapterTitles: false,
    content,
    css: css + customCss,
  };
  const filePath = path.join(prg_options.path, `${title}.epub`);
  const epub = new EPub(epubOptions, filePath);
  epub
    .render()
    .then(() => {
      console.log(chalk.green("\nEbook Generated Successfully!"), chalk.cyan(filePath + "\n"));
    })
    .catch((err) => {
      console.error(chalk.bold.red("Failed to generate Ebook because of ", err));
    });
}

async function main() {
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

  // Now create a media source for each RSS feed, fetch & format them and add them to the ebook list
  let epubContent: EpubContentOptions[] = [];
  let customCss: string = "";
  let parsed: string[] = [];
  let epubCover: string | undefined;
  for (const rssFeed of rssFeeds) {
    // Create the MediaSource which can handle this feed
    const mediaSource = createMediaSource(rssFeed, prg_options.debug);
    if (mediaSource) {
      // Retrieve news from service and remove already parsed ones
      let newsList = await mediaSource.retrieveNewsListFromSource();
      newsList = newsList.filter((news) => (news.guid ? !parsed.includes(news.guid) : true));

      // Add news guid to the parsed articles to not treat several times the same ones
      parsed = parsed.concat(newsList.map((news) => (news.guid ? news.guid : "")));

      // If we're in interactive mode, allow the user to filter the articles he wants to keep
      if (prg_options.interactive) {
        console.info(chalk.bold.magenta(mediaSource.feedTitle));
        const questions = [
          {
            type: "multiselect",
            name: "selection",
            message: "Select the articles you want to read",
            choices: newsList.map((news) => {
              return { title: news.title, value: news, selected: true };
            }),
            hint: "- Space & Left/Right to toggle. Return to submit",
          },
        ];
        const response = await prompts(questions as any);
        newsList = response.selection;
      }

      // Retrieve and format articles
      epubContent = epubContent.concat(await mediaSource.computeArticlesFromNewsList(newsList));
      // Set cover if we don't have one yet
      if (!epubCover) epubCover = mediaSource.mediaSourceCover;
      // Set css if there is one for this media
      if (mediaSource.customCss && !customCss.includes(mediaSource.customCss)) customCss += mediaSource.customCss;
    }
  }
  // Finally, create the ebook !
  generateNewsEpub(prg_options.title, epubContent, customCss, epubCover);
}

// Enter script
main();
