import { renderTopLanguages } from "../src/cards/top-languages-card.js";
import {
  CONSTANTS,
  parseArray,
  parseBoolean,
  renderError,
} from "../src/common/utils.js";
import { fetchTopLanguages } from "../src/fetchers/top-languages-fetcher.js";
import { isLocaleAvailable } from "../src/translations.js";

export default async (req, res) => {
  const {
    hide,
    hide_title,
    hide_border,
    card_width,
    title_color,
    text_color,
    bg_color,
    theme,
    cache_seconds,
    layout,
    langs_count,
    exclude_repo,
    size_weight,
    count_weight,
    custom_title,
    locale,
    border_radius,
    border_color,
    disable_animations,
    hide_progress,
  } = req.query;
  res.setHeader("Content-Type", "image/svg+xml");

  if (locale && !isLocaleAvailable(locale)) {
    return res.send(renderError("Something went wrong", "Locale not found"));
  }

  if (
    layout !== undefined &&
    (typeof layout !== "string" ||
      !["compact", "normal", "donut", "donut-vertical", "pie"].includes(layout))
  ) {
    return res.send(
      renderError("Something went wrong", "Incorrect layout input"),
    );
  }

  try {
    const topLangsSummed = {};
    for (let i = 1; i <= 2; i++) {
      const username = process.env[`PAT_${i}_USER`];
      const pat = process.env[`PAT_${i}`]

      const topLangs = await fetchTopLanguages(
        username,
        pat,
        parseArray(exclude_repo),
        size_weight,
        count_weight,
      );

      Object.keys(topLangs).forEach((lang) => {
        if (!topLangsSummed[lang]) {
          topLangsSummed[lang] = topLangs[lang];
        } else {
          topLangsSummed[lang].rawSize += topLangs[lang].rawSize;
          topLangsSummed[lang].rawCount += topLangs[lang].rawCount;
        }
      })
    }

    Object.keys(topLangsSummed).forEach((name) => {
      // comparison index calculation
      topLangsSummed[name].size =
        Math.pow(topLangsSummed[name].rawSize, size_weight ?? 1) *
        Math.pow(topLangsSummed[name].rawCount, count_weight ?? 0);
    });

    const topLangs = Object.keys(topLangsSummed)
      .sort((a, b) => topLangsSummed[b].size - topLangsSummed[a].size)
      .reduce((result, key) => {
        result[key] = topLangsSummed[key];
        return result;
      }, {});

    let cacheSeconds = parseInt(
      cache_seconds || CONSTANTS.TOP_LANGS_CACHE_SECONDS,
      10,
    );
    cacheSeconds = process.env.CACHE_SECONDS
      ? parseInt(process.env.CACHE_SECONDS, 10) || cacheSeconds
      : cacheSeconds;

    res.setHeader(
      "Cache-Control",
      `max-age=${cacheSeconds / 2}, s-maxage=${cacheSeconds}`,
    );

    return res.send(
      renderTopLanguages(topLangs, {
        custom_title,
        hide_title: parseBoolean(hide_title),
        hide_border: parseBoolean(hide_border),
        card_width: parseInt(card_width, 10),
        hide: parseArray(hide),
        title_color,
        text_color,
        bg_color,
        theme,
        layout,
        langs_count,
        border_radius,
        border_color,
        locale: locale ? locale.toLowerCase() : null,
        disable_animations: parseBoolean(disable_animations),
        hide_progress: parseBoolean(hide_progress),
      }),
    );
  } catch (err) {
    res.setHeader(
      "Cache-Control",
      `max-age=${CONSTANTS.ERROR_CACHE_SECONDS / 2}, s-maxage=${
        CONSTANTS.ERROR_CACHE_SECONDS
      }, stale-while-revalidate=${CONSTANTS.ONE_DAY}`,
    ); // Use lower cache period for errors.
    return res.send(
      renderError(err.message, err.secondaryMessage, {
        title_color,
        text_color,
        bg_color,
        border_color,
        theme,
      }),
    );
  }
};
