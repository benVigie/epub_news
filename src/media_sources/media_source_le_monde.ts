import chalk from "chalk";
import Parser from "rss-parser";
import { parse } from "node-html-parser";
import { MediaSource, TrimArticleError } from "./media_source.js";
import { Options } from "../epub_news.js";

// List of useless html nodes we can rid of
const CLEAN_DOM_LIST = [
  ".meta.meta__social",
  ".inread.js-services-inread",
  ".aside__iso",
  ".services-carousel",
  ".services.services--footer",
  ".article__reactions",
  ".article__siblings",
  ".article__status",
  ".meta__article-en-fr-url-link",
  ".catcher__favorite",
  "picture",
];
// Regex to match all kinds of feeds from Le Monde
const RSS_MATCHING_REGEX = new RegExp("(^https://www.lemonde.fr/){1}[a-z/_-]*(rss)+[a-z/_]*(.xml$){1}");
// Constants of image size embeded in news image url
const DEFAUT_FEED_IMAGE_SIZE = "644/322";
const EXPECTED_COVER_IMAGE_SIZE = "1410/2250";

// Custom RSS types for Le Monde
type CustomRssFeed = {}; // Nothing to add at feed level
type CustomRssItem = { "media:content": any }; // Adding media:content to retrieve news picture

/**
 * Implementation of MediaSource for Le Monde RSS feeds
 * https://www.lemonde.fr
 */
export default class LeMondeMediaSource extends MediaSource<CustomRssFeed, CustomRssItem> {
  constructor(source: string, options: Options) {
    super(source, options);

    // Create a new rss parser with custom "Le Monde" fields
    this._rss_parser = new Parser({
      customFields: { feed: [], item: ["media:content"] },
    });

    // Security check. Without cookie, you can't retrieve membership articles from Le Monde
    if (!process.env.LE_MONDE_COOKIE) {
      console.error(chalk.bold.red("Missing environment variable LE_MONDE_COOKIE."));
      console.error(chalk.yellow("It can result in incorrect news fetching for members exclusive articles.\n"));
    }
  }

  public static isHandlingRssFeed(rssFeedUrl: string): boolean {
    return RSS_MATCHING_REGEX.test(rssFeedUrl);
  }

  /**
   * Set request options to be used when fetching articles
   * Adding Le Monde cookies to the request
   */
  protected setFetchOptions(): void {
    if (process.env.LE_MONDE_COOKIE) {
      this._fetchOptions["headers"] = { Cookie: process.env.LE_MONDE_COOKIE };
    }
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
    // Do not compute live feeds from Le Monde
    if (newsFeed.title && newsFeed.title.startsWith("En direct")) {
      throw new TrimArticleError("is a live stream, skip");
    }

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

    // Manage images.
    const images = root.querySelectorAll("img");
    images.forEach((img) => {
      const dataSrc = img.getAttribute("src");
      if (dataSrc && dataSrc.includes("data:image/svg+xml")) {
        img.remove();
      }
    });

    // Create a book cover from this article
    this.createBookCoverFromArticle(newsFeed, article);

    // If we can retrieve the article, return it!
    let domArticle = root.querySelector(".zone.zone--article");
    if (domArticle) return domArticle.toString();
    domArticle = root.querySelector(".article--longform.article--content");
    if (domArticle) return domArticle.toString();

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

      // Le Monde already has a image service that resize its article's pictures. If we have specified size in url, change them to a bigger image that suit epub expectations
      if (this._cover && this._cover.indexOf(DEFAUT_FEED_IMAGE_SIZE) >= 0) {
        this._cover = this._cover.replace(DEFAUT_FEED_IMAGE_SIZE, EXPECTED_COVER_IMAGE_SIZE);
      }
    }
  }

  /**
   * Custom css to inject in the final epub
   */
  public get customCss(): string | undefined {
    return `
.zone--article img, .article--content img {
  min-width: 80%;
  padding: 8px 10%;
}
.zone--article figcaption, .article--content figcaption {
  opacity: 0.75;
  font-style: italic;
  font-size: 80%;
  padding: 0 10%;
  text-align: center;
  padding: 0;
}

.breadcrumb {
  list-style-type: none;
  padding: 0;
  margin: 0;
}
.breadcrumb li {
  display: inline
  margin: 0;
  padding: 0;
}
.breadcrumb li:before {
  content: "/";
  padding: 0 8px;
}
`;
  }
}
