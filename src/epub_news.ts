import fs from "node:fs";
import path from "node:path";
import Parser from "rss-parser";
import { DateTime } from "luxon";
import { EPub, EpubContentOptions, EpubOptions } from "@lesjoursfr/html-to-epub";
import createMediaSource from "./media_sources/media_source_factory.js";
import { ComputeArticlesResult } from "./media_sources/media_source.js";

const UNKNOWN_RSS_FEED_TITLE = "No feed title";
const LOCALE = process.env.LOCALE || "fr";
const dt: DateTime = DateTime.now().setLocale(LOCALE);

export type EpubArticle = EpubContentOptions;

/** MediaSource options */
export interface Options {
  debug?: boolean;
  details?: boolean;
}

export interface ArticlesFetchingResult {
  title: string;
  link: string;
  success: boolean;
  error?: string;
}

export interface EbookResult {
  result: string;
  title: string;
  path: string;
  articles: ArticlesFetchingResult[];
}

/**
 * Describe article list
 */
export interface ArticlesList {
  feed: string;
  feedTitle: string;
  articles: Parser.Item[];
}

/**
 * Rss articles formated from feed, with cover image and css
 */
export interface EpubArticlesData extends ComputeArticlesResult {
  feedTitle: string;
  cover: string | undefined;
  customCss: string | undefined;
}

/** Thrown when we can't create a MediaSource for the given rss feed */
export class NoMediaSourceError extends Error {}

/**
 * EpubNews is the lib which controls the fetching of articles and generate the epub news
 */
export default class EpubNews {
  private _options: Options;
  private _fetching: ArticlesFetchingResult[];

  constructor(options?: Options) {
    // Default values
    options = { debug: false, details: false, ...options };
    this._options = options;
    this._fetching = [];
  }

  /**
   * Retrieves a list of articles from a specified RSS feed URL.
   *
   * @param rssFeedUrl - The URL of the RSS feed from which to retrieve articles.
   * @returns A Promise that resolves to an ArticlesList object containing the feed title and an array of articles.
   * @throws NoMediaSourceError - If no media source is found for the given RSS feed URL.
   */
  async listArticlesFromFeed(rssFeedUrl: string): Promise<ArticlesList> {
    // Try to retrieve a media source from the feed
    const mediaSource = createMediaSource(rssFeedUrl, this._options);
    if (!mediaSource) {
      throw new NoMediaSourceError(
        `No media source implemented for ${rssFeedUrl}> Are you sure it matches one of your MediaSource implementation ?`,
      );
    }

    // Fetch news from the service and return them in a ArticlesList format
    return {
      articles: await mediaSource.retrieveNewsListFromSource(),
      feedTitle: mediaSource.feedTitle || UNKNOWN_RSS_FEED_TITLE,
      feed: rssFeedUrl,
    };
  }

  /**
   * Generates the data required to create an EPUB file from a list of articles.
   *
   * @param rssFeedUrl - The URL of the RSS feed from which to retrieve articles.
   * @param articles - An array of articles to be included in the EPUB file.
   * @returns A Promise that resolves to an EpubArticlesData object containing the feed title, a list of articles, a cover image URL, and a custom CSS URL.
   * @throws NoMediaSourceError - If no media source is found for the given RSS feed URL.
   */
  async getEpubDataFromArticles(rssFeedUrl: string, articles: Array<Parser.Item>): Promise<EpubArticlesData> {
    // Try to retrieve a media source from the feed
    const mediaSource = createMediaSource(rssFeedUrl, this._options);
    if (!mediaSource) {
      throw new NoMediaSourceError(
        `No media source implemented for ${rssFeedUrl}> Are you sure it matches one of your MediaSource implementation ?`,
      );
    }

    // Fetch and format epub data from the given article list
    return {
      ...(await mediaSource.computeArticlesFromNewsList(articles)),
      feedTitle: mediaSource.feedTitle || UNKNOWN_RSS_FEED_TITLE,
      cover: mediaSource.mediaSourceCover,
      customCss: mediaSource.customCss,
    };
  }

  /**
   * Generates a new ebook from a list of articles
   *
   * @param filePath - The path where the generated EPUB file will be saved
   * @param title - The title of the EPUB file
   * @param content - An array of articles to be included in the EPUB file
   * @param customCss - A custom CSS to be applied to the EPUB file
   * @param cover - An optional cover image URL for the EPUB file
   * @param description - An optional description for the EPUB file
   * @returns A Promise that resolves to an object containing the result of the EPUB generation
   */
  async generateEpubNews(
    filePath: string,
    title: string,
    content: EpubArticle[],
    customCss: string,
    cover?: string,
    description?: string,
  ): Promise<EbookResult> {
    const css = fs.readFileSync(path.resolve(import.meta.dirname, "../epub.css"));

    const epubOptions: EpubOptions = {
      title,
      description: description || `Les titres du ${dt.toLocaleString(DateTime.DATE_FULL)}`,
      author: "Le Monde",
      cover: cover,
      lang: LOCALE,
      tocTitle: "Liste des articles",
      appendChapterTitles: false,
      content,
      css: css + customCss,
    };

    const epub = new EPub(epubOptions, filePath);
    const r = await epub.render();
    return {
      result: r.result,
      title,
      path: filePath,
      articles: [],
    };
  }
}
