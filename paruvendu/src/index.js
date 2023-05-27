// puppeteer-extra is a drop-in replacement for puppeteer,
// it augments the installed puppeteer with plugin functionality
const puppeteer = require('puppeteer-extra');
const fs = require('fs');
const path = require('path');
const commandLineArgs = require('command-line-args');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const DELAY_AFTER_LOAD_MS = 500;

// Init the plugin before anything else
// By default, all evasion techniques are set
puppeteer.use(StealthPlugin())

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function scrapeOnePage(url, dep, pageIndex) {
  const data = [];
  let lastPage = false;
  const browser = await puppeteer.launch({
    args: ['--no-sandbox'], // useful when using docker (allow using app as admin)
    headless: "new",
    ignoreHTTPSErrors: true,
  });
  const page = await browser.newPage();

  try {

    // Set a timeout for all subsequent actions performed on the page
    page.setDefaultTimeout(50000); // 50000 seconds
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await delay(DELAY_AFTER_LOAD_MS);

    // Click on the button
    await page.click('div.container.buttons button:nth-child(2)');

    // check if next button exists
    const nextButton = await page.$('div.pgsuiv');
    if (!nextButton) {
      lastPage = true;
      console.log("[LAST PAGE TO SCRAP IN THIS SECTION]");
    }

    // Check n° 2, are we really on the wanted page
    const currentPageNumber = await page.$eval('nav > span.border-red', span => parseInt(span.textContent));
    if (currentPageNumber != pageIndex) {
        lastPage = true;
        console.log("[LAST PAGE ATTAINED ! RETURNED TO FIRST PAGE]");
        // Return directly with no data
        await browser.close();
        return [data, lastPage];
    }
    
    //Scrape the data and push it into the `data` array
    const hrefs = await page.$$eval('.flex.sm\\:block.gap-4 a', links => links.map(link => link.href));

    let i = 1;
    for (const href of hrefs) {
      await page.goto(href, { waitUntil: 'domcontentloaded' });
      await delay(DELAY_AFTER_LOAD_MS);

      const pageTitle = await page.title();
      // Remove all special characters
      const cleanInput = pageTitle.replace(/[^\w\s]/gi, '');
      // Split the input by whitespace
      const parts = cleanInput.split(/\s+/)
      const typeBien = parts[2];
      if (typeBien == "voiture") {
        return [1, false]; // crawler has beeb detected
      }

      // get the ref
      const refSelector = 'ul.crit-alignbloc li';
      const refElements = await page.$$(refSelector);
      let ref = refElements[refElements.length - 2] ? await refElements[refElements.length - 2].evaluate(el => el.textContent.trim().replace(/[^\d]/g, '')) : 'none';
      console.log(ref, href)

      // get the surface
      const surfaceSelector = 'li.surf span';
      const surfaceElement = await page.$(surfaceSelector);
      let surface = surfaceElement ? await surfaceElement.evaluate(el => el.textContent) : 'none';
      surface = parseInt(surface.replace(/[^0-9]/g, ''));

      // get the price
      const priceSelector = 'div#autoprix';
      const priceElement = await page.$(priceSelector);
      let price = priceElement ? await priceElement.evaluate(el => el.textContent.trim()) : 'none';
      price = parseInt(price.replace(/[^\d]/g, ''));

      // get the city and code postale
      let ville = '';
      let codePostale = '';
      const localisationSelector = 'span#detail_loc';
      const localisationElement = await page.$(localisationSelector);
      const localisationPost = localisationElement ? await localisationElement.evaluate(el => el.textContent.trim().replace(/[^a-zA-Z0-9 ]/g, "")) : 'none';
      const match = localisationPost.match(/^(.*)\s+(\d{5})$/);
      if (match) {
        ville = match[1].trim();
        codePostale = match[2];
      } else {
        ville = '';
        codePostale = '';
      }
      ref = ville + "-" + ref;

      const pieceSelector = 'li.nbp span';
      const pieceElement = await page.$(pieceSelector);
      const pieces = pieceElement ? await pieceElement.evaluate(el => parseInt(el.textContent.trim())) : 'none';

      const features = await page.evaluate(() => {
        const infos = document.querySelectorAll('ul.crit-alignbloc');
        const result = {};
        for (let i = 0; i < infos.length; i++) {
          const spans = infos[i].querySelectorAll('li span');
          spans.forEach((span) => {
            const [key, value] = span.textContent.trim().split(':');
            if (key && value) {
              result[key.trim()] = value.trim();
            } else {
              result[key.trim()] = null;
            }
          });
        }
        return result;
      });

      const imageSelector = 'img.im11_pic_main';
      const imageElement = await page.$(imageSelector);
      const image = imageElement ? await imageElement.evaluate(el => el.src) : 'none';

      const energySelector = 'div .DPE_consEnerNote';
      const energyElement = await page.$(energySelector);
      const classEnergy = energyElement ? await energyElement.evaluate(el => el.textContent.trim()) : 'ND';

      const gazSelector = 'div .DPE_effSerreNote';
      const gazElement = await page.$(gazSelector);
      const gazEmission = gazElement ? await gazElement.evaluate(el => el.textContent.trim()) : 'ND';

      features['classEnergy'] = classEnergy;
      features['gazEmission'] = gazEmission;

      const url = href;

      const descriptionSelector = 'div#txtAnnonceTrunc';
      const descriptionElement = await page.$(descriptionSelector);
      const description = descriptionElement ? await descriptionElement.evaluate(el => el.textContent.replace(/[\n\t]/g, '').replace(/\s{2,}/g, ' ')) : 'none';

      const hasCuisine = description.includes('cuisine');
      const cuisine = hasCuisine ? true : false;

      const departement = dep;

      const scrapedData = { title: pageTitle, url, ref, typeBien, ville, codePostale, departement, price, surface, pieces, cuisine, features, description, image };
      data.push(scrapedData);
      console.log(`[ANNONCE ${i} SCRAPPED]`);
      i += 1;

    }
  } catch (e) {
    if (e instanceof puppeteer.TimeoutError) {
      console.error('Timeout error:', e.message);
      await browser.close();
      return [data, lastPage]; // error and not last page
    } else {
      console.error('Other error:', e.message);
    }
  }


  await browser.close();
  return [data, lastPage];
}

async function scrapeOneDepartment(depNumber) {
  let i = 1;
  const allData = [];

  while (true) {
    const url = `https://www.paruvendu.fr/immobilier/annonceimmofo/liste/listeAnnonces?tt=1&tbApp=1&tbMai=1&at=1&pa=FR&lo=${depNumber}&ddlFiltres=nofilter&p=${i}`;

    try {
      const [data, lastPage] = await scrapeOnePage(url, depNumber, i);
      if (lastPage) {
        console.log("[SCRAPING HAS FINISHED]");
        allData.push(...data);
        return allData;
      }

      if (data === 1) {
        console.warn("Data is '1', what ?");
        i++;
        continue;
      }

      allData.push(...data);
      console.log("[SCRAPING FINISHED FOR PAGE %d]", i);
      i++;

    } catch (error) {
      i++;
      console.error("An error occurred during scraping:", error);
    }
  }
}

const parseArgs = () => {
  const optionDefitions = [
    {
      // Required
      name: "output",
      alias: "o",
      type: String,
      description: "The path of the folder where to store data"
    }
  ];
  const options = commandLineArgs(optionDefitions);

  // Check if valid
  if (!options.output) {
    throw new Error('"--output" argument required');
  }
  if (!fs.existsSync(options.output)) {
    throw new Error(`Output directory does not exist : ${options.output}`);
  }

  return options;
};


const main = async () => {

  const startTime = Date.now();

  const args = parseArgs();
  const outputPath = args.output;
  console.log("[SCRAPPING INITIATED...]")

  const allData = [];

  for (let depNumber = 1; depNumber <= 95; depNumber++) {
    const startDepTime = Date.now();
    console.log("Scrape for department", depNumber);

    const depNumberString = depNumber <= 9 ? "0" + depNumber : depNumber.toString();
    data = await scrapeOneDepartment(depNumberString);
    allData.push(...data);

    const endDepTime = Date.now();
    console.log(`[DEPT EXECUTION TIME : ${endDepTime - startDepTime}ms]`);

    // Save this to one file
    const outputFilePath = path.resolve(outputPath, `dept_${depNumberString}.json`);
    console.log("Save to path", outputFilePath);
    fs.writeFileSync(outputFilePath, JSON.stringify(data));
  }

  const endTime = Date.now();
  console.log(`[TOTAL EXECUTION TIME : ${endTime - startTime}ms]`);

  const allDataOutputPath = path.resolve(outputPath, `allData.json`);
  console.log("Save final file to", allDataOutputPath);
  fs.writeFileSync(outputFilePath, JSON.stringify(allData));
};


try {
  main();
} catch (err) {
  console.error("An error occured while scrapping data");
  console.error(err);
}
