// Right now we don't need JS to get nintendo product prices.
// Their product page embed a JSON with the prices into a script element.

import { configSync as loadConfig } from "https://deno.land/std@0.166.0/dotenv/mod.ts";
import puppeteer, {
  Product,
} from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import { cheerio } from "https://deno.land/x/cheerio@1.0.7/mod.ts";
const config = loadConfig({ safe: true });

const url =
  "https://www.nintendo.com/store/products/xenoblade-chronicles-2-switch/";

try {
  const browser = await puppeteer.launch({
    product: config.PUPPETEER_PRODUCT as Product,
  });
  const page = await browser.newPage();
  await page.goto(url);

  const html = await page.content();

  const $ = cheerio.load(html);

  // const pageText = $(".RadioDetailedstyles__StyledPrice-sc-1n7uq3p-3").text();
  // script type="application/ld+json"
  const pageText = $("script[type='application/ld+json']").text();

  console.log(pageText);

  await browser.close();
} catch (error) {
  console.log(error);
}
