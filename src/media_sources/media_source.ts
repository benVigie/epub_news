import https from "https";
import chalk from "chalk";
import Parser from "rss-parser";
import ora, { Ora } from "ora";
import terminalLink from "terminal-link";
import { EpubContentOptions } from "@lesjoursfr/html-to-epub";

/** Default trim article error */
export class TrimArticleError extends Error {}

/**
 * Media source is the abstract class every media source must inherit from.
 * It will manage the rss fetching, retrieve the news content and format it to be injected in the final ebook.
 */
export abstract class MediaSource<T = { [key: string]: any }, U = { [key: string]: any }> {
  protected _rss_sources: string;
  protected _rss_parser: Parser<T, U>;
  protected _debug: boolean;
  protected _feedTitle: string | undefined;
  protected _spinner: Ora;
  protected _fetchOptions: https.RequestOptions;
  protected _cover: string | undefined;

  constructor(source: string, debug: boolean = false) {
    this._rss_sources = source;
    this._debug = debug;
    this._spinner = ora();
    this._fetchOptions = {};
    // You may need to create a new parser which will match your source's feed and items custom fields
    this._rss_parser = new Parser({
      customFields: { feed: [], item: [] },
    });
  }

  /**
   * Get the media source cover image
   */
  public get mediaSourceCover(): string | undefined {
    return this._cover;
  }

  /**
   * Get the parsed feed title
   */
  public get feedTitle(): string | undefined {
    return this._feedTitle;
  }

  /**
   * Retrieve the news list from RSS source
   * @returns the news list
   */
  public async retrieveNewsListFromSource(): Promise<Array<Parser.Item & U>> {
    return await this.parseRSSFeed();
  }

  /**
   * Static method used by the factory generator to know if the current implementation is consuming the given rss feed
   * @param rssFeedUrl
   */
  public static isHandlingRssFeed(rssFeedUrl: string): boolean {
    throw new Error("Your MediaSOurce implementation must implement this function");
  }

  /**
   * Fetch and trim articles from the given news list
   * @param newsList The news list to parse
   * @returns A list of EpubContentOptions ready to be injected in the ebook
   */
  public async computeArticlesFromNewsList(newsList: Array<Parser.Item & U>): Promise<Array<EpubContentOptions>> {
    const articles: Array<EpubContentOptions> = [];

    // Set fetch options before starting to retrieve articles
    this.setFetchOptions();

    for (const news of newsList) {
      if (news.link && news.title) {
        // Start info spinner
        this.startInfoSpinner(news.title);

        // Fetch news article from rss link
        const article = await this.retrieveArticle(news.link);
        try {
          // Try to parse the article. If we have something, add it to the ebook
          const trimedArticle = this.trimArticleForEpub(news, article);
          articles.push({
            title: news.title,
            data: trimedArticle,
          });
          this._spinner.suffixText = chalk.green("ok");
          this._spinner.succeed();
        } catch (error) {
          if (error instanceof TrimArticleError) {
            this._spinner.suffixText = chalk.yellow(error.toString());
          }
          // If an error occurs, display the article link in console for information
          const link = terminalLink(news.title, news.link);
          this._spinner.warn(chalk.italic.gray(link));
        }
      } else {
        this._spinner.warn(chalk.italic.red("No title or link for this news, skip"));
      }
    }
    return articles;
  }

  /***
   * Parse the RSS feed to extract articles
   *
   * @returns A promise with the article list on success
   */
  protected async parseRSSFeed(): Promise<Array<U & Parser.Item>> {
    const feed = await this._rss_parser.parseURL(this._rss_sources);
    if (this._debug) console.info(chalk.blue.magenta(feed.title));

    this._feedTitle = feed.title;
    feed.items.forEach((item) => {
      if (this._debug) {
        console.log(chalk.blue(`  - ${item.title}`), chalk.gray(`(${item.pubDate})`));
      }
    });

    return feed.items;
  }

  /**
   * Set request options to be used when fetching articles.
   * Useful for some media which rely on cookies (or other header stuff) to idenitfy the user and serve logged content
   */
  protected setFetchOptions(): void {
    this._fetchOptions = {};
  }

  /**
   * Fetch the news article. It will use a custom header if set
   *
   * @param url The article url to fetch
   * @returns a promise with the whole html page fetched on success
   */
  protected async retrieveArticle(url: string): Promise<string> {
    if (this._spinner) this._spinner.suffixText = chalk.italic.green("downloading...");

    return new Promise((resolve, reject) => {
      let data = "";

      https.get(url, this._fetchOptions, (res) => {
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

  /**
   * Trim raw html article content to be injected in epub.
   * Here you can filter which nodes you want to keep to the ebook
   *
   * @param newsFeed News item from RSS feed
   * @param article Raw html page retrieved from the news source
   * @return The DOM article as string
   */
  protected abstract trimArticleForEpub(newsFeed: Parser.Item & U, article: string): string;

  /**
   * Create an ebook cover from the given article. The result can be either a url or a file path
   *
   * @param newsFeed News item from RSS feed
   * @param article Raw html page retrieved from the news source
   */
  protected abstract createBookCoverFromArticle(newsFeed: Parser.Item & U, article: string): void;

  /**
   * Start a new info spinner
   * @param text Spinner text
   */
  protected startInfoSpinner(text: string): void {
    this._spinner = ora(chalk.italic(text));
    this._spinner.indent = 2;
    this._spinner.start();
  }
}
