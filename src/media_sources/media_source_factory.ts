import chalk from "chalk";
import { MediaSource } from "./media_source.js";
import LeMondeMediaSource from "./media_source_le_monde.js";

/**
 * MediaSource factory. It will create a MediaSource instance according to the given rss feed url.
 * If no match is found, null will be returned.
 * @param rssFeedUrl
 */
export default function createMediaSource(rssFeedUrl: string, debug: boolean): MediaSource | null {
  // Try to match with Le Monde implementation
  if (LeMondeMediaSource.isHandlingRssFeed(rssFeedUrl)) return new LeMondeMediaSource(rssFeedUrl, debug);

  console.error(chalk.bold.red("No MediaSource match"), chalk.bold.yellow(rssFeedUrl));
  console.error(chalk.red("Did you miss the implementation for this media or the url is malformed ?"));
  return null;
}
