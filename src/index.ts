#!/usr/bin/env node

import path from "node:path";
import "dotenv/config";
import chalk from "chalk";
import { EPub, EpubContentOptions, EpubOptions } from "@lesjoursfr/html-to-epub";
import { Command, OptionValues } from "commander";
import { DateTime } from "luxon";
import LeMondeMediaSource from "./media_sources/media_source_le_monde.js";
import prompts from "prompts";

// Globals and tools
const program = new Command();
const dt: DateTime = DateTime.now().setLocale("fr");
let prg_options: OptionValues;

// Constants
const FLUX = ["https://www.lemonde.fr/rss/une.xml"];

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

function generateNewsEpub(title: string, content: EpubContentOptions[], cover?: string) {
  const epubOptions: EpubOptions = {
    title,
    description: `Les titres du ${dt.toLocaleString(DateTime.DATE_FULL)}`,
    author: "Le Monde",
    cover: cover,
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
      console.log(chalk.green("\nEbook Generated Successfully!"), chalk.cyan(filePath + "\n"));
    })
    .catch((err) => {
      console.error(chalk.bold.red("Failed to generate Ebook because of ", err));
    });
}

async function main() {
  // Create a Le Monde media source instance
  const mediaSource = new LeMondeMediaSource(FLUX[0], prg_options.debug);

  // Retrieve news from service
  let newsList = await mediaSource.retrieveNewsListFromSource();

  // If we're in interactive mode, allow the user to filter the articles he wants to keep
  if (prg_options.interactive) {
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
  const epubContent = await mediaSource.computeArticlesFromNewsList(newsList);

  // Finally, create the ebook !
  generateNewsEpub(prg_options.title, epubContent, mediaSource.mediaSourceCover);
}

main();
