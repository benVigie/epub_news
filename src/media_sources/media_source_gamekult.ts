import chalk from "chalk";
import Parser from "rss-parser";
import { parse } from "node-html-parser";
import { MediaSource, TrimArticleError } from "./media_source.js";
import { Options } from "../epub_news.js";

const GAMEKULT_FEED_URL = "https://www.gamekult.com/feed.xml";
// Regex to match Gamekult image sizes
const IMAGE_SIZE_REGEX = new RegExp("(__[hw][0-9]+.)");

// List of useless html nodes we can rid of
const CLEAN_DOM_LIST = [
  "script",
  ".gk__button__comment",
  ".ed__review__article__footer__infos",
  ".ed__editorial__footer",
  ".ed__news__details",
  ".gk__text__video",
  ".gk__text__container--full",
  ".ed__news__footer__share",
  ".gk__button__comment",
  ".g2__list--12",
  ".ed__review__article__header__infos",
  ".ed__review__article__header__price",
  ".gk__text__container.gk__text__content.gk__text__row",
];

// Custom RSS types for Gamekult
type CustomRssFeed = {}; // Nothing to add at feed level
type CustomRssItem = { "media:content": any }; // Adding media:content to retrieve news picture

/**
 * Implementation of MediaSource for Gamekult feeds
 * https://www.gamekult.com/
 */
export default class GamekultMediaSource extends MediaSource<CustomRssFeed, CustomRssItem> {
  constructor(source: string, options: Options) {
    super(source, options);

    // Create a new rss parser with custom Gamekult fields
    this._rss_parser = new Parser({
      customFields: { feed: [], item: ["media:content"] },
    });
  }

  public static isHandlingRssFeed(rssFeedUrl: string): boolean {
    return rssFeedUrl === GAMEKULT_FEED_URL;
  }

  /**
   * Trim raw html article content to be injected in epub.
   * Here you can filter which nodes you want to keep to the ebook
   *
   * @param newsFeed News item from RSS feed
   * @param article Raw html page retrieved from the news source
   * @return The DOM article as string
   */
  protected trimArticleForEpub(newsFeed: Parser.Item & CustomRssItem, article: string): string {
    // Update user feedback
    if (this._options.details) this._spinner.suffixText = chalk.italic.green("trimming...");

    // Remove useless nodes
    const root = parse(article);
    for (const node_name of CLEAN_DOM_LIST) {
      const nodes = root.querySelectorAll(node_name);
      for (const node of nodes) {
        node.remove();
      }
    }

    // Manage images. Gamekult is using lazy loading, so we need to replace img src when necessary
    const images = root.querySelectorAll("img");
    images.forEach((img) => {
      const dataSrc = img.getAttribute("data-src");
      if (dataSrc) {
        img.setAttribute("src", dataSrc);
      }
      const src = img.getAttribute("src");
      if (src && IMAGE_SIZE_REGEX.test(src)) {
        img.setAttribute("src", src.replace(IMAGE_SIZE_REGEX, "__w1440."));
      }
    });

    // Create a book cover from this article
    this.createBookCoverFromArticle(newsFeed, article);

    // For game tests !
    let domArticle = root.querySelector(".ed__review__article");
    if (domArticle) return domArticle.toString().replaceAll(`src="//cdn.gamekult.com`, `src="https://cdn.gamekult.com`);
    // Regular news
    domArticle = root.querySelector("article.js-start-progression-bar");
    if (domArticle) return domArticle.toString().replaceAll(`src="//cdn.gamekult.com`, `src="https://cdn.gamekult.com`);

    throw new TrimArticleError("empty, skip");
  }

  /**
   * Create an ebook cover from the given article. The result can be either a url or a file path
   *
   * @param newsFeed News item from RSS feed
   * @param article Raw html page retrieved from the news source
   */
  protected createBookCoverFromArticle(newsFeed: Parser.Item & CustomRssItem, article: string): void {
    // If we don't have a cover yet
    if (!this._cover && newsFeed["media:content"]["$"]["url"]) {
      this._cover = newsFeed["media:content"]["$"]["url"];
    }
  }

  /**
   * Custom css to inject in the final epub
   */
  public get customCss(): string | undefined {
    return `
 img {
  display: block;
  min-width: 100%;
  padding: 8px 0;
}

figcaption {
  padding: 0;
  opacity: 0.75;
  font-style: italic;
  font-size: 80%;
  text-align: center;
}
`;
  }
}
